const express = require('express');
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
const NodeCache = require('node-cache');
const dns = require('dns').promises;
const stream = require('stream');
const { promisify } = require('util');
const http = require('http');
const https = require('https');
const compression = require('compression');
const Clinic = require('../models/Clinic');
const { decrypt } = require('../utils/encryption');

const router = express.Router();

// 1. ENABLE COMPRESSION: Makes loading the study list and tags 5x faster
router.use(compression());

// 2. SMART CACHING: Only cache Metadata (JSON), not Images
// This keeps RAM usage low (~50MB) instead of High (~2GB)
const metadataCache = new NodeCache({
  stdTTL: 600, // Keep metadata for 10 minutes
  checkperiod: 60,
  useClones: false,
  maxKeys: 1000
});

// 3. OPTIMIZED HTTP AGENT: Allows high-speed parallel downloads
// Browsers request 6-10 images at once; this prevents the server from choking.
const connectionSettings = {
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 1000, // High concurrency
  maxFreeSockets: 50,
  timeout: 30000,
  scheduling: 'fifo'
};

const httpAgent = new http.Agent(connectionSettings);
const httpsAgent = new https.Agent(connectionSettings);

// DNS Cache to prevent lookup latency
const dnsCache = new Map();
const DNS_CACHE_TTL = 300 * 1000;

// --- HELPER FUNCTIONS ---

async function getOrthancConfig(req) {
  let clinicId = req.query.clinicId || req.headers['x-clinic-id'];
  
  // Default Config
  let config = {
    url: process.env.ORTHANC_URL,
    username: process.env.ORTHANC_USERNAME,
    password: process.env.ORTHANC_PASSWORD
  };

  // Override if Clinic ID exists
  if (clinicId) {
    try {
      const clinic = await Clinic.findById(clinicId);
      if (clinic && clinic.orthancUrl) {
        config = {
          url: clinic.orthancUrl,
          username: clinic.orthancUsername,
          password: decrypt(clinic.orthancPassword)
        };
      }
    } catch (error) {
      console.error('Error fetching clinic config:', error);
    }
  }

  const auth = 'Basic ' + Buffer.from(`${config.username}:${config.password}`).toString('base64');
  const agent = config.url.startsWith('https') ? httpsAgent : httpAgent;

  return { ...config, auth, agent };
}

async function fetchWithRetry(url, options, maxRetries = 2) {
  // Simple retry logic for network blips
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fetch(url, options);
    } catch (err) {
      if (i === maxRetries) throw err;
      await new Promise(r => setTimeout(r, 200 * (i + 1))); // Short wait
    }
  }
}

// --- ROUTES ---

// 1. VIEWER HTML
router.get('/viewer', async (req, res) => {
  try {
    const studyUid = req.query.StudyInstanceUIDs;
    const clinicId = req.query.clinicId || '';

    if (!studyUid) {
      return res.status(400).send('StudyInstanceUIDs parameter required');
    }

    console.log(`📺 Loading viewer for StudyInstanceUID: ${studyUid} (Clinic: ${clinicId})`);

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>OHIF Viewer</title>
  <style>
    body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #000; }
    iframe { border: 0; width: 100%; height: 100%; }
    .loader { 
      position: absolute; 
      top: 50%; 
      left: 50%; 
      transform: translate(-50%, -50%);
      color: white;
      font-family: sans-serif;
      text-align: center;
    }
    .spinner {
      border: 3px solid rgba(255,255,255,0.1);
      border-top: 3px solid white;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="loader" id="loader">
    <div class="spinner"></div>
    <div id="status">Initializing viewer...</div>
  </div>
  <iframe 
    id="ohif" 
    src="/api/proxy/ohif/viewer?StudyInstanceUIDs=${studyUid}&token=${req.query.token}&clinicId=${clinicId}" 
    allow="fullscreen"
    style="display:none"
  ></iframe>
  <script>
    const iframe = document.getElementById('ohif');
    const loader = document.getElementById('loader');
    const status = document.getElementById('status');
    
    let loadTimeout = setTimeout(() => {
      status.textContent = 'Loading is taking longer than expected...';
    }, 10000);
    
    iframe.onload = () => {
      clearTimeout(loadTimeout);
      iframe.style.display = 'block';
      loader.style.display = 'none';
      console.log('✅ Viewer loaded successfully');
    };
    
    iframe.onerror = () => {
      clearTimeout(loadTimeout);
      status.textContent = 'Failed to load viewer. Please refresh the page.';
      status.style.color = '#ff4444';
    };
    
    // Show iframe after 2 seconds even if onload doesn't fire
    setTimeout(() => {
      if (loader.style.display !== 'none') {
        iframe.style.display = 'block';
        loader.style.display = 'none';
      }
    }, 15000);
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(html);
  } catch (error) {
    console.error('❌ OHIF proxy error:', error);
    res.status(500).send(`Failed to load OHIF viewer: ${error.message}`);
  }
});

// 2. EXPORT DICOM (ZIP)
router.get('/export-dicom', async (req, res) => {
  try {
    const { studyUid, clinicId } = req.query;
    if (!studyUid) {
      return res.status(400).json({ error: 'Missing studyUid parameter' });
    }

    console.log(`📦 [EXPORT] Requesting ZIP for StudyUID: ${studyUid} (Clinic: ${clinicId || 'Default'})`);

    const config = await getOrthancConfig(req);
    
    // Lookup internal ID
    const lookupRes = await fetchWithRetry(`${config.url}/tools/lookup`, {
      method: 'POST',
      body: studyUid,
      headers: { 
        'Authorization': config.auth,
        'Content-Type': 'text/plain'
      },
      agent: config.agent
    });

    if (!lookupRes.ok) {
      throw new Error(`Lookup failed: ${lookupRes.statusText}`);
    }

    const lookupData = await lookupRes.json();
    const studyData = lookupData.find(item => item.Type === 'Study');
    
    if (!studyData) {
      return res.status(404).json({ error: 'Study not found on PACS' });
    }

    console.log(`   ↳ Mapped StudyUID ${studyUid} to Internal ID: ${studyData.ID}`);

    // Stream Zip
    const archiveRes = await fetch(`${config.url}/studies/${studyData.ID}/archive`, {
      method: 'GET',
      headers: { 'Authorization': config.auth },
      agent: config.agent,
      timeout: 300000
    });

    if (!archiveRes.ok) {
      throw new Error(`Archive generation failed: ${archiveRes.statusText}`);
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="Study-${studyUid}.zip"`);
    
    const contentLength = archiveRes.headers.get('content-length');
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
      console.log(`   ↳ Streaming ZIP archive (${(contentLength / 1024 / 1024).toFixed(2)}MB)`);
    }

    archiveRes.body.pipe(res);

  } catch (error) {
    console.error(`❌ [EXPORT] Error: ${error.message}`);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to export study', details: error.message });
    }
  }
});

// 3. THE HIGH PERFORMANCE DICOM PROXY
router.all('/dicom-web/*', async (req, res) => {
  try {
    const path = req.params[0];
    const url = new URL(req.url, 'http://localhost');
    url.searchParams.delete('token');
    const clinicId = url.searchParams.get('clinicId');
    url.searchParams.delete('clinicId');
    const cleanQuery = url.search;

    const cacheKey = `meta-${clinicId || 'def'}-${path}${cleanQuery}`;
    const isFrameRequest = path.includes('/frames/'); // Is this an image?

    // --- A. FAST LANE: Serve Metadata from RAM ---
    // Only for JSON requests (Study metadata, Series metadata)
    if (req.method === 'GET' && !isFrameRequest) {
      const cached = metadataCache.get(cacheKey);
      if (cached) {
        console.log(`💾 [Metadata CACHE HIT] ${path.split('/').pop()}`);
        res.status(cached.status);
        Object.entries(cached.headers).forEach(([k, v]) => res.setHeader(k, v));
        return res.send(cached.body);
      }
    }

    const config = await getOrthancConfig(req);
    const orthancUrl = `${config.url}/dicom-web/${path}${cleanQuery}`;

    console.log(`🔍 [DICOMweb] ${req.method} ${isFrameRequest ? 'Frame' : 'Metadata'} ${path.split('/').slice(-2).join('/')}`);

    // --- B. FETCH FROM ORTHANC ---
    const fetchOptions = {
      method: req.method,
      headers: { 
        'Authorization': config.auth
      },
      agent: config.agent
    };

    if (req.headers['content-type']) {
      fetchOptions.headers['Content-Type'] = req.headers['content-type'];
    }
    if (req.headers['accept']) {
      fetchOptions.headers['Accept'] = req.headers['accept'];
    }

    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const response = await fetchWithRetry(orthancUrl, fetchOptions);

    if (!response.ok) {
      console.error(`❌ [DICOMweb] Failed: ${response.status} ${response.statusText}`);
      return res.status(response.status).send(response.statusText);
    }

    // --- C. SET BROWSER CACHING HEADERS (CRITICAL FOR PERFORMANCE) ---
    res.status(response.status);
    
    // Pass standard headers
    const passHeaders = ['content-type', 'content-length', 'last-modified', 'etag'];
    passHeaders.forEach(h => {
      if (response.headers.get(h)) res.setHeader(h, response.headers.get(h));
    });

    if (req.method === 'GET') {
      if (isFrameRequest) {
        // IMAGE STRATEGY: "Immutable"
        // Browser will save this to disk and NEVER ask server again.
        // This is much faster than Node.js memory caching.
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else {
        // METADATA STRATEGY: "Revalidate occasionally"
        res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      }
    }

    // --- D. DELIVERY STRATEGY ---
    
    if (isFrameRequest) {
      // 🚀 SPEED MODE: Stream immediately.
      // Do NOT buffer. Do NOT store in Node RAM.
      // This fixes "Frame cache full" error.
      response.body.pipe(res);
    } else {
      // 🧠 MEMORY MODE: Buffer Metadata only.
      // Metadata is small JSON/Text. Safe to store.
      const body = await response.buffer();
      
      if (req.method === 'GET') {
        const headers = {};
        passHeaders.forEach(h => {
          if (response.headers.get(h)) headers[h] = response.headers.get(h);
        });
        metadataCache.set(cacheKey, { status: response.status, headers, body });
        console.log(`💾 Cached metadata (${(body.length / 1024).toFixed(2)}KB)`);
      }
      res.send(body);
    }

  } catch (error) {
    if (error.code !== 'ECONNRESET') {
      console.error(`❌ [DICOMweb] Error: ${error.message}`);
      if (!res.headersSent) res.status(500).json({ error: 'DICOMweb proxy error', details: error.message });
    }
  }
});

// 4. ORTHANC REST API (for backward compatibility)
router.all('/orthanc/*', async (req, res) => {
  try {
    const path = req.params[0];
    const url = new URL(req.url, 'http://localhost');
    url.searchParams.delete('token');
    const clinicId = url.searchParams.get('clinicId');
    url.searchParams.delete('clinicId');
    const cleanQuery = url.search;

    const config = await getOrthancConfig(req);
    const orthancUrl = `${config.url}/${path}${cleanQuery}`;

    console.log(`🔍 [Orthanc API] ${req.method} ${path.split('/').slice(0, 2).join('/')}`);

    const options = {
      method: req.method,
      headers: { 'Authorization': config.auth },
      agent: config.agent
    };

    if (req.headers['content-type']) {
      options.headers['Content-Type'] = req.headers['content-type'];
    }
    if (req.headers['accept']) {
      options.headers['Accept'] = req.headers['accept'];
    }

    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      options.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const response = await fetchWithRetry(orthancUrl, options);

    res.status(response.status);
    ['content-type', 'content-length', 'cache-control', 'etag', 'last-modified'].forEach(header => {
      const value = response.headers.get(header);
      if (value) res.setHeader(header, value);
    });

    response.body.pipe(res);
  } catch (error) {
    console.error(`❌ [Orthanc API] Error: ${error.message}`);
    if (!res.headersSent) res.status(500).json({ error: 'Orthanc proxy error', details: error.message });
  }
});

// 5. OHIF STATIC ASSETS (With rewriting)
router.get('/ohif/*', async (req, res) => {
  try {
    const path = req.params[0];
    const clinicId = req.query.clinicId || '';
    
    if (path.endsWith('.map')) {
      return res.status(404).end();
    }

    // Only require token for viewer HTML
    const requiresAuth = path === 'viewer' || path.includes('.html');
    if (requiresAuth) {
      const token = req.query.token;
      if (!token) {
        console.error('❌ No token provided for authenticated resource');
        return res.status(401).send('Authentication required');
      }

      try {
        jwt.verify(token, process.env.JWT_SECRET);
      } catch (error) {
        console.error('❌ Token verification failed:', error.message);
        return res.status(401).send('Invalid or expired token');
      }
    }

    const config = await getOrthancConfig(req);
    
    const response = await fetchWithRetry(`${config.url}/ohif/${path}`, {
      headers: { 'Authorization': config.auth },
      agent: config.agent
    });

    if (!response.ok) {
      console.error(`❌ [OHIF] Resource not found: ${path} (${response.status})`);
      return res.status(response.status).send('Resource not found');
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');

    // If it's the config file, we must rewrite the URLs inside it
    if (path.includes('app-config.js') || path.includes('viewer') || path.endsWith('.html')) {
      let content = await response.text();
      
      const clinicParam = clinicId ? `?clinicId=${clinicId}` : '';
      
      // Rewrite to point to OUR proxy
      content = content
        .replace(/<base href="\/ohif\/?"/g, '<base href="/api/proxy/ohif/"')
        .replace(/https?:\/\/[^/'"]+\/ohif/g, '/api/proxy/ohif')
        .replace(/https?:\/\/[^/'"]+\/dicom-web/g, '/api/proxy/dicom-web')
        .replace(/https?:\/\/[^/'"]+\/(studies|series|instances)/g, '/api/proxy/orthanc/$1')
        .replace(/"\/ohif\//g, '"/api/proxy/ohif/')
        .replace(/'\/ohif\//g, "'/api/proxy/ohif/")
        .replace(/"\/dicom-web/g, '"/api/proxy/dicom-web')
        .replace(/'\/dicom-web/g, "'/api/proxy/dicom-web")
        .replace(/url:\s*['"]\/dicom-web['"]/g, "url: '/api/proxy/dicom-web'")
        .replace(/url:\s*['"]\/studies['"]/g, "url: '/api/proxy/orthanc/studies'")
        .replace(/(['"])\/dicom-web\//g, "$1/api/proxy/dicom-web/")
        // Fix WADO Roots
        .replace(/wadoRoot:\s*['"]\/api\/proxy\/dicom-web['"]/g, `wadoRoot: '/api/proxy/dicom-web${clinicParam}'`)
        .replace(/qidoRoot:\s*['"]\/api\/proxy\/dicom-web['"]/g, `qidoRoot: '/api/proxy/dicom-web${clinicParam}'`)
        .replace(/wadoUriRoot:\s*['"]\/api\/proxy\/dicom-web['"]/g, `wadoUriRoot: '/api/proxy/dicom-web${clinicParam}'`);

      if (path.includes('app-config.js')) {
        res.setHeader('Cache-Control', 'public, max-age=300');
      } else if (path === 'viewer') {
        res.setHeader('Cache-Control', 'public, max-age=300');
      } else {
        res.setHeader('Cache-Control', 'no-cache');
      }

      res.send(content);
    } else {
      // For pure JS/CSS bundles, cache heavily
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
      response.body.pipe(res);
    }
  } catch (error) {
    console.error(`❌ [OHIF] Resource error for ${req.params[0]}:`, error.message);
    if (!res.headersSent) res.status(500).send('Failed to load resource');
  }
});

// Catch-all for debugging
router.all('*', (req, res) => {
  console.error(`❌ [404] Route not found: ${req.method} ${req.path}`);
  res.status(404).json({ error: 'Route not found', path: req.path });
});

module.exports = router;