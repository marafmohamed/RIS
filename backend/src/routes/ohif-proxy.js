const express = require('express');
const router = express.Router();
const { createProxyMiddleware } = require('http-proxy-middleware');
const Settings = require('../models/Settings');
const auth = require('../middleware/auth');

// OHIF Proxy endpoint - proxies requests to Orthanc with authentication
router.use('/viewer/*', auth, async (req, res, next) => {
  try {
    // Get Orthanc credentials from settings
    const settings = await Settings.findOne();
    if (!settings || !settings.orthancUrl || !settings.orthancUsername || !settings.orthancPassword) {
      return res.status(500).json({ error: 'Orthanc credentials not configured' });
    }

    // Create proxy middleware with authentication
    const proxy = createProxyMiddleware({
      target: settings.orthancUrl,
      changeOrigin: true,
      pathRewrite: {
        '^/api/ohif-proxy/viewer': '/ohif/viewer'
      },
      auth: `${settings.orthancUsername}:${settings.orthancPassword}`,
      onProxyReq: (proxyReq, req, res) => {
        // Add Basic Auth header
        const auth = Buffer.from(`${settings.orthancUsername}:${settings.orthancPassword}`).toString('base64');
        proxyReq.setHeader('Authorization', `Basic ${auth}`);
      },
      onError: (err, req, res) => {
        console.error('Proxy error:', err);
        res.status(500).json({ error: 'Failed to proxy request to Orthanc' });
      }
    });

    proxy(req, res, next);
  } catch (error) {
    console.error('OHIF proxy error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
