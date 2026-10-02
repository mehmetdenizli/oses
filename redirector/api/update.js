// Vercel Serverless Function - Store Active POS Kasa Tunnel Target URL
let activeTargetUrl = null;
let lastUpdated = null;

// Export in-memory storage reference
global.posTargetStore = global.posTargetStore || {
  targetUrl: null,
  lastUpdated: null
};

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    const { target_url, secret } = req.body || {};
    
    if (!target_url) {
      return res.status(400).json({ error: 'target_url is required' });
    }

    global.posTargetStore.targetUrl = target_url;
    global.posTargetStore.lastUpdated = new Date().toISOString();

    return res.status(200).json({
      status: 'success',
      message: 'Active POS Kasa Tunnel URL updated successfully!',
      targetUrl: target_url,
      lastUpdated: global.posTargetStore.lastUpdated
    });
  }

  return res.status(200).json({
    status: 'active',
    currentStore: global.posTargetStore
  });
}
