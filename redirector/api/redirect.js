// Vercel Edge Serverless Function - Instant Smart Redirect to Active Kasa POS Tunnel
global.posTargetStore = global.posTargetStore || {
  targetUrl: null,
  lastUpdated: null
};

export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const searchParams = url.search; // preserves ?masa=Masa1 etc.

  const activeTarget = global.posTargetStore.targetUrl;

  if (activeTarget) {
    let cleanTarget = activeTarget.endsWith('/') ? activeTarget.slice(0, -1) : activeTarget;
    let finalUrl = `${cleanTarget}/qr${searchParams}`;
    
    // Perform instant 302 redirect
    res.writeHead(302, { Location: finalUrl });
    return res.end();
  }

  // Fallback view if Kasa POS computer is offline / starting up
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
        setTimeout(() => location.reload(), 4000);
      </script>
    </body>
    </html>
  `);
}
