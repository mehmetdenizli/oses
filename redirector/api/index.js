// Unified Vercel Serverless Function & Smart Redirector
let inMemoryStore = {
  targetUrl: null,
  lastUpdated: null
};

async function getKvTargetUrl() {
  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (kvUrl && kvToken) {
    try {
      const resp = await fetch(`${kvUrl}/get/targetUrl`, {
        headers: { Authorization: `Bearer ${kvToken}` }
      });
      const data = await resp.json();
      if (data && data.result) return data.result;
    } catch (e) {
      console.error('KV get error:', e);
    }
  }
  return inMemoryStore.targetUrl;
}

async function setKvTargetUrl(targetUrl) {
  inMemoryStore.targetUrl = targetUrl;
  inMemoryStore.lastUpdated = new Date().toISOString();

  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (kvUrl && kvToken) {
    try {
      await fetch(`${kvUrl}/set/targetUrl/${encodeURIComponent(targetUrl)}`, {
        headers: { Authorization: `Bearer ${kvToken}` }
      });
    } catch (e) {
      console.error('KV set error:', e);
    }
  }
}

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // 1. API: Update target tunnel URL from Kasa POS
  if (pathname.startsWith('/api/update')) {
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) {}
      }
      const target_url = body && body.target_url;
      if (!target_url) {
        return res.status(400).json({ error: 'target_url is required' });
      }

      await setKvTargetUrl(target_url);
      return res.status(200).json({
        status: 'success',
        message: 'Active POS Kasa Tunnel URL updated successfully!',
        targetUrl: target_url,
        lastUpdated: inMemoryStore.lastUpdated
      });
    }

    const currentTarget = await getKvTargetUrl();
    return res.status(200).json({
      status: 'active',
      currentStore: {
        targetUrl: currentTarget,
        lastUpdated: inMemoryStore.lastUpdated
      }
    });
  }

  // 2. Customer QR Menu Redirect
  const activeTarget = await getKvTargetUrl();
  const searchParams = url.search; // preserves ?masa=Masa1

  if (activeTarget) {
    const cleanTarget = activeTarget.endsWith('/') ? activeTarget.slice(0, -1) : activeTarget;
    const finalUrl = `${cleanTarget}/qr${searchParams}`;
    
    // Redirect instantly to active Kasa tunnel
    res.writeHead(302, { Location: finalUrl });
    return res.end();
  }

  // 3. Fallback screen if POS is offline or just starting
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>O Ses Çiğköfte - Kasa Hazırlanıyor</title>
      <style>
        body { font-family: sans-serif; text-align: center; padding: 40px 20px; background: #F8FAFC; color: #1E293B; }
        .card { background: white; padding: 30px; border-radius: 20px; max-width: 450px; margin: 0 auto; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        h1 { color: #D32F2F; font-size: 1.5rem; margin-bottom: 10px; }
        p { color: #64748B; font-size: 0.95rem; line-height: 1.5; }
        .spinner { margin: 20px auto; width: 40px; height: 40px; border: 4px solid #F3F3F3; border-top: 4px solid #D32F2F; border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>🌶️ O SES ÇİĞKÖFTE</h1>
        <div class="spinner"></div>
        <p><strong>Kasa POS Sunucumuz Hazırlanıyor...</strong></p>
        <p>Lütfen birkaç saniye bekleyin, menünüz otomatik olarak açılacaktır.</p>
      </div>
      <script>
        setTimeout(() => location.reload(), 3000);
      </script>
    </body>
    </html>
  `);
}
