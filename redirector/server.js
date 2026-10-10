// O Ses POS - Lifelong Permanent Smart Redirector for Render.com (.com domain)
const http = require('http');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;

// In-memory target store
let posTargetStore = {
  targetUrl: null,
  lastUpdated: null
};

// Upstash Redis KV config (optional persistent storage)
const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function getKvTargetUrl() {
  if (kvUrl && kvToken) {
    try {
      const resp = await fetch(`${kvUrl}/get/targetUrl`, {
        headers: { Authorization: `Bearer ${kvToken}` }
      });
      const data = await resp.json();
      if (data && data.result) {
        posTargetStore.targetUrl = data.result;
        return data.result;
      }
    } catch (e) {
      console.error('KV get error:', e.message);
    }
  }
  return posTargetStore.targetUrl;
}

async function setKvTargetUrl(targetUrl) {
  posTargetStore.targetUrl = targetUrl;
  posTargetStore.lastUpdated = new Date().toISOString();

  if (kvUrl && kvToken) {
    try {
      await fetch(`${kvUrl}/set/targetUrl/${encodeURIComponent(targetUrl)}`, {
        headers: { Authorization: `Bearer ${kvToken}` }
      });
    } catch (e) {
      console.error('KV set error:', e.message);
    }
  }
}

// Initial fetch from Redis on startup
if (kvUrl && kvToken) {
  getKvTargetUrl().then(url => {
    if (url) console.log('✅ Upstash KV aktif tünel adresi yüklendi:', url);
  });
}

const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname;
  const searchParams = reqUrl.search; // preserves ?masa=Masa1

  // 1. API: Update active Kasa POS Tunnel URL
  if (pathname.startsWith('/api/update')) {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body || '{}');
          const target_url = parsed.target_url;
          if (!target_url) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'target_url is required' }));
          }

          await setKvTargetUrl(target_url);
          console.log(`[SYNC] Canlı tünel güncellendi: ${target_url}`);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            status: 'success',
            message: 'Active POS Kasa Tunnel URL updated successfully!',
            targetUrl: target_url,
            lastUpdated: posTargetStore.lastUpdated
          }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
        }
      });
      return;
    }

    // GET /api/update -> Current status
    const currentTarget = await getKvTargetUrl();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      status: 'active',
      currentStore: {
        targetUrl: currentTarget,
        lastUpdated: posTargetStore.lastUpdated
      }
    }));
  }

  // 2. Health check
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
  }

  // 3. Customer QR Code Redirect: /qr or /
  const activeTarget = await getKvTargetUrl();

  if (activeTarget) {
    const cleanTarget = activeTarget.endsWith('/') ? activeTarget.slice(0, -1) : activeTarget;
    const finalUrl = `${cleanTarget}/qr${searchParams}`;
    
    // Instant 302 Redirect to active POS
    res.writeHead(302, {
      'Location': finalUrl,
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    return res.end();
  }

  // 4. Fallback screen if POS is offline or booting
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  return res.end(`
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
});

server.listen(PORT, () => {
  console.log(`🚀 O Ses POS Yönlendirici Render üzerinde aktif! Port: ${PORT}`);
});
