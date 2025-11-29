const express = require('express');
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
const NodeCache = require('node-cache');
const dns = require('dns').promises;
const stream = require('stream');
const { promisify } = require('util');
const Clinic = require('../models/Clinic');
const { decrypt } = require('../utils/encryption');

const router = express.Router();
const pipeline = promisify(stream.pipeline);

// Aggressive caching for OHIF resources and metadata
const resourceCache = new NodeCache({
  stdTTL: 3600, // 1 hour default
  checkperiod: 120,
  useClones: false,
  maxKeys: 2000 // Increased limit for more resources
});

const metadataCache = new NodeCache({
  stdTTL: 600, // 10 minutes for metadata
  checkperiod: 60,
  useClones: false
});

// Frame data cache (for DICOM pixel data)
const frameCache = new NodeCache({
  stdTTL: 3600, // 1 hour for frames
  checkperiod: 120,
  useClones: false,
  maxKeys: 500, // Increased to handle large studies with many frames
  deleteOnExpire: true // Automatically delete expired entries
});

let configCache = null;
let configCacheTime = 0;
const CONFIG_CACHE_TTL = 5 * 60 * 1000;

// DNS cache
const dnsCache = new Map();
const DNS_CACHE_TTL = 5 * 60 * 1000;

// HTTP Agent for connection pooling
const http = require('http');
const https = require('https');

// Helper to get Orthanc config for a request
async function getOrthancConfig(req) {
  let clinicId = req.query.clinicId || req.headers['x-clinic-id'];

  // Default config from env
  let config = {
    url: process.env.ORTHANC_URL,
    username: process.env.ORTHANC_USERNAME,
    password: process.env.ORTHANC_PASSWORD
  };

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
  const agent = new (config.url.startsWith('https') ? https : http).Agent({
    keepAlive: true,
    keepAliveMsecs: 30000,
    maxSockets: 100,
    maxFreeSockets: 20,
    timeout: 120000,
    scheduling: 'lifo'
  });

  return { ...config, auth, agent };
}

// Retry fetch with exponential backoff
async function fetchWithRetry(url, options, maxRetries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;

      // DNS caching
      const cached = dnsCache.get(hostname);
      if (!cached || (Date.now() - cached.time) > DNS_CACHE_TTL) {
        try {
          await dns.lookup(hostname);
          dnsCache.set(hostname, { time: Date.now() });
        } catch (dnsError) {
          console.warn(`⚠️  DNS lookup failed for ${hostname} (attempt ${attempt}/${maxRetries})`);
          if (attempt === maxRetries) throw dnsError;
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
      }

      return await fetch(url, options);
    } catch (error) {
      lastError = error;

      // Retry on network errors
      if (error.code === 'EAI_AGAIN' || error.code === 'ENOTFOUND' ||
        error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
        console.warn(`⚠️  Network error (attempt ${attempt}/${maxRetries}): ${error.message}`);
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }

      throw error;
    }
  }

  throw lastError;
}

// Performance logging
const logPerformance = (label) => (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 5000) {
      console.log(`⚠️  [${label}] SLOW: ${req.method} ${req.path} - ${duration}ms - ${res.statusCode}`);
    } else if (duration > 1000) {
      console.log(`⚡ [${label}] ${req.method} ${req.path} - ${duration}ms - ${res.statusCode}`);
    } else {
      console.log(`✅ [${label}] ${req.method} ${req.path} - ${duration}ms - ${res.statusCode}`);
    }
  });

  next();
};

// Viewer wrapper page
router.get('/viewer', logPerformance('VIEWER'), async (req, res) => {
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
  <link rel="preload" href="/api/proxy/ohif/app.bundle.b34f32c5020ee27ad26.js?clinicId=${clinicId}" as="script">
  <link rel="preload" href="/api/proxy/ohif/app-config.js?clinicId=${clinicId}" as="script">
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

// DICOMweb endpoint with caching
router.all('/dicom-web/*', logPerformance('DICOMWEB'), async (req, res) => {
  const start = Date.now();
  try {
    const path = req.params[0];
    const url = new URL(req.url, 'http://localhost');
    url.searchParams.delete('token');
    const clinicId = url.searchParams.get('clinicId');
    url.searchParams.delete('clinicId'); // Remove from forwarded query
    const cleanQuery = url.search;

    const cacheKey = `dicom-${clinicId || 'default'}-${req.method}-${path}${cleanQuery}`;

    // Check cache for GET requests
    if (req.method === 'GET') {
      // Check frame cache for pixel data
      if (path.includes('/frames/')) {
        const cached = frameCache.get(cacheKey);
        if (cached) {
          console.log(`💾 [Frame CACHE HIT] ${path.substring(path.lastIndexOf('/'))}`);
          res.status(cached.status);
          Object.entries(cached.headers).forEach(([key, value]) => {
            res.setHeader(key, value);
          });
          return res.send(cached.body);
        }
      } else {
        // Check metadata cache
        const cached = metadataCache.get(cacheKey);
        if (cached) {
          console.log(`💾 [Metadata CACHE HIT] ${path.split('/').pop()}`);
          res.status(cached.status);
          Object.entries(cached.headers).forEach(([key, value]) => {
            res.setHeader(key, value);
          });
          return res.send(cached.body);
        }
      }
    }

    const config = await getOrthancConfig(req);
    const orthancUrl = `${config.url}/dicom-web/${path}${cleanQuery}`;

    console.log(`🔍 [DICOMweb] ${req.method} ${path.split('/').slice(-2).join('/')} (Clinic: ${clinicId || 'Default'})`);

    const options = {
      method: req.method,
      headers: { 'Authorization': config.auth },
      agent: config.agent,
      timeout: 120000 // 2 minute timeout for large frames
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
    const fetchTime = Date.now() - start;

    console.log(`   ↳ Orthanc responded in ${fetchTime}ms - Status: ${response.status}`);

    // Cache successful GET requests
    if (req.method === 'GET' && response.ok) {
      const body = await response.buffer();
      const headers = {};
      ['content-type', 'content-length', 'cache-control', 'etag'].forEach(header => {
        const value = response.headers.get(header);
        if (value) headers[header] = value;
      });

      // Cache frames (pixel data) longer
      if (path.includes('/frames/')) {
        try {
          frameCache.set(cacheKey, { status: response.status, headers, body }, 3600);
          console.log(`💾 Cached frame (${(body.length / 1024).toFixed(2)}KB)`);
        } catch (cacheError) {
          console.warn(`⚠️  Frame cache full, skipping cache for this frame`);
        }
      } else if (path.includes('metadata')) {
        try {
          metadataCache.set(cacheKey, { status: response.status, headers, body }, 600);
        } catch (cacheError) {
          console.warn(`⚠️  Metadata cache full, skipping cache`);
        }
      } else {
        try {
          metadataCache.set(cacheKey, { status: response.status, headers, body }, 300);
        } catch (cacheError) {
          console.warn(`⚠️  Metadata cache full, skipping cache`);
        }
      }

      res.status(response.status);
      Object.entries(headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
      return res.send(body);
    }

    // Stream response for non-cached
    res.status(response.status);
    ['content-type', 'content-length', 'cache-control', 'etag', 'last-modified'].forEach(header => {
      const value = response.headers.get(header);
      if (value) res.setHeader(header, value);
    });

    response.body.pipe(res);
  } catch (error) {
    console.error(`❌ [DICOMweb] Error: ${error.message}`);
    res.status(500).json({ error: 'DICOMweb proxy request failed', details: error.message });
  }
});

// Orthanc REST API
router.all('/orthanc/*', logPerformance('ORTHANC'), async (req, res) => {
  const start = Date.now();
  try {
    const path = req.params[0];
    const url = new URL(req.url, 'http://localhost');
    url.searchParams.delete('token');
    const clinicId = url.searchParams.get('clinicId');
    url.searchParams.delete('clinicId');
    const cleanQuery = url.search;

    const config = await getOrthancConfig(req);
    const orthancUrl = `${config.url}/${path}${cleanQuery}`;

    console.log(`🔍 [Orthanc API] ${req.method} ${path.split('/').slice(0, 2).join('/')} (Clinic: ${clinicId || 'Default'})`);

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
    const fetchTime = Date.now() - start;

    console.log(`   ↳ Orthanc responded in ${fetchTime}ms - Status: ${response.status}`);

    res.status(response.status);
    ['content-type', 'content-length', 'cache-control', 'etag', 'last-modified'].forEach(header => {
      const value = response.headers.get(header);
      if (value) res.setHeader(header, value);
    });

    response.body.pipe(res);
  } catch (error) {
    console.error(`❌ [Orthanc API] Error: ${error.message}`);
    res.status(500).json({ error: 'Orthanc proxy request failed', details: error.message });
  }
});

// OHIF static resources - no auth required for bundles
router.get('/ohif/*', logPerformance('OHIF-STATIC'), async (req, res) => {
  const start = Date.now();
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

    // Check cache
    const cacheKey = `ohif-${path}`;
    const cached = resourceCache.get(cacheKey);
    if (cached) {
      console.log(`💾 [OHIF CACHE HIT] ${path.split('/').pop()}`);
      res.setHeader('Content-Type', cached.contentType);
      res.setHeader('Cache-Control', cached.cacheControl);
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.send(cached.body);
    }

    const config = await getOrthancConfig(req);
    const url = `${config.url}/ohif/${path}`;

    // Check config cache (skip for now as it might be clinic specific)
    // Actually config might be same for all, but let's be safe and fetch fresh if clinicId changes?
    // For now, let's just fetch.

    console.log(`📦 [OHIF] Fetching: ${path.split('/').pop()}`);

    const response = await fetchWithRetry(url, {
      headers: { 'Authorization': config.auth },
      agent: config.agent
    });

    const fetchTime = Date.now() - start;

    if (!response.ok) {
      console.error(`❌ [OHIF] Resource not found: ${path} (${response.status})`);
      return res.status(response.status).send('Resource not found');
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Handle text files that need URL rewriting
    if (path.includes('app-config.js') || path === 'viewer' || path.includes('.html')) {
      let content = await response.text();

      console.log(`🔧 [OHIF] Rewriting URLs in ${path.split('/').pop()} (${fetchTime}ms)`);

      // Append clinicId to proxy URLs so subsequent requests carry it
      const clinicParam = clinicId ? `?clinicId=${clinicId}` : '';
      const clinicParamAmp = clinicId ? `&clinicId=${clinicId}` : '';

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
        .replace(/(['"])\/dicom-web\//g, "$1/api/proxy/dicom-web/");

      // Inject clinicId into API calls in JS
      // This is tricky. simpler to just rely on the fact that we inject it in the iframe src
      // and OHIF might propagate query params? No, it doesn't usually.
      // We might need to monkey-patch the config to add query params to the servers.

      if (path.includes('app-config.js')) {
        // Modify the servers config to include clinicId in the wadoRoot etc
        // This is a bit hacky but effective
        content = content.replace(
          /wadoRoot:\s*['"]\/api\/proxy\/dicom-web['"]/g,
          `wadoRoot: '/api/proxy/dicom-web${clinicParam}'`
        ).replace(
          /qidoRoot:\s*['"]\/api\/proxy\/dicom-web['"]/g,
          `qidoRoot: '/api/proxy/dicom-web${clinicParam}'`
        ).replace(
          /wadoUriRoot:\s*['"]\/api\/proxy\/dicom-web['"]/g,
          `wadoUriRoot: '/api/proxy/dicom-web${clinicParam}'`
        );
      }

      if (path.includes('app-config.js')) {
        res.setHeader('Cache-Control', 'public, max-age=300');
      } else if (path === 'viewer') {
        res.setHeader('Cache-Control', 'public, max-age=300');
      } else {
        res.setHeader('Cache-Control', 'no-cache');
      }

      res.send(content);
    } else {
      // Static assets - cache aggressively
      const size = response.headers.get('content-length');
      const cacheControl = 'public, max-age=31536000, immutable';
      res.setHeader('Cache-Control', cacheControl);

      // Cache files under 5MB
      if (size && parseInt(size) < 5 * 1024 * 1024) {
        const body = await response.buffer();
        resourceCache.set(cacheKey, {
          contentType,
          cacheControl,
          body
        }, 86400);
        res.send(body);
      } else {
        response.body.pipe(res);
      }
    }
  } catch (error) {
    console.error(`❌ [OHIF] Resource error for ${req.params[0]}:`, error.message);
    res.status(500).send('Failed to load resource');
  }
});

// Catch-all for debugging
router.all('*', (req, res) => {
  console.error(`❌ [404] Route not found: ${req.method} ${req.path}`);
  res.status(404).json({ error: 'Route not found', path: req.path });
});

module.exports = router;