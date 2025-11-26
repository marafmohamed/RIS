const express = require('express');
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
const NodeCache = require('node-cache');
const dns = require('dns').promises;
const stream = require('stream');
const { promisify } = require('util');

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
const ORTHANC_URL = process.env.ORTHANC_URL;
const ORTHANC_AUTH = 'Basic ' + Buffer.from(`${process.env.ORTHANC_USERNAME}:${process.env.ORTHANC_PASSWORD}`).toString('base64');

const keepAliveAgent = new (ORTHANC_URL.startsWith('https') ? https : http).Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 100, // Increased for parallel requests
  maxFreeSockets: 20,
  timeout: 120000, // 2 minutes for large frames
  scheduling: 'lifo' // Reuse most recent connections
});

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

// Verify token
const verifyTokenFromQuery = (req, res, next) => {
  try {
    const token = req.query.token;
    if (!token) {
      console.error('❌ No token provided');
      return res.status(401).send('Authentication required');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('❌ Token verification failed:', error.message);
    return res.status(401).send('Invalid or expired token');
  }
};

console.log(`🔧 OHIF Proxy initialized with Orthanc URL: ${ORTHANC_URL}`);

// Pre-warm cache with common OHIF bundles on startup
async function prewarmCache() {
  console.log('🔥 Pre-warming cache with common OHIF bundles...');

  // List of common bundles that are the same for all users
  const commonBundles = [
    'viewer', // Main viewer HTML
    'app-config.js', // Configuration
    'app.bundle.b34f32c5020ee27ad26.js', // Main app bundle (adjust the hash to match your version)
    // Add more common bundles here as you identify them
  ];

  const prewarmStart = Date.now();
  let successCount = 0;
  let totalSize = 0;

  for (const bundle of commonBundles) {
    try {
      const url = `${ORTHANC_URL}/ohif/${bundle}`;
      console.log(`   📦 Fetching: ${bundle}`);

      const response = await fetchWithRetry(url, {
        headers: { 'Authorization': ORTHANC_AUTH },
        agent: keepAliveAgent
      }, 2); // Only 2 retries for startup

      if (response.ok) {
        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        const body = await response.buffer();

        // Handle URL rewriting for text files
        if (bundle.includes('.js') || bundle.includes('.html') || bundle === 'viewer') {
          let content = body.toString('utf8');

          // Apply URL rewriting
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

          // Cache the rewritten content
          const cacheKey = `ohif-${bundle}`;
          resourceCache.set(cacheKey, {
            contentType,
            cacheControl: 'public, max-age=31536000, immutable',
            body: Buffer.from(content, 'utf8')
          }, 86400);

          // Special handling for config
          if (bundle.includes('app-config.js')) {
            configCache = content;
            configCacheTime = Date.now();
          }
        } else {
          // Binary files - cache as-is
          const cacheKey = `ohif-${bundle}`;
          resourceCache.set(cacheKey, {
            contentType,
            cacheControl: 'public, max-age=31536000, immutable',
            body
          }, 86400);
        }

        totalSize += body.length;
        successCount++;
        console.log(`   ✅ Cached ${bundle} (${(body.length / 1024).toFixed(2)}KB)`);
      } else {
        console.warn(`   ⚠️  Failed to fetch ${bundle}: ${response.status}`);
      }
    } catch (error) {
      console.warn(`   ⚠️  Failed to prewarm ${bundle}: ${error.message}`);
    }
  }

  const duration = Date.now() - prewarmStart;
  console.log(`🔥 Cache prewarming complete: ${successCount}/${commonBundles.length} bundles cached (${(totalSize / 1024 / 1024).toFixed(2)}MB) in ${duration}ms`);

  // Schedule next prewarm in 1 hour
  setTimeout(prewarmCache, 60 * 60 * 1000);
}

// Auto-discover and cache bundles from first real user request
let bundleDiscoveryEnabled = true;
const discoveredBundles = new Set();

function recordBundleRequest(path) {
  if (bundleDiscoveryEnabled && path.includes('.bundle.') && path.endsWith('.js')) {
    if (!discoveredBundles.has(path)) {
      discoveredBundles.add(path);
      console.log(`📝 Discovered new bundle: ${path}`);

      // After discovering 10 bundles, log them for manual addition
      if (discoveredBundles.size >= 10) {
        console.log(`\n🎯 DISCOVERED COMMON BUNDLES - Add these to prewarmCache():`);
        discoveredBundles.forEach(bundle => console.log(`    '${bundle}',`));
        console.log('');
        bundleDiscoveryEnabled = false; // Stop discovery after first batch
      }
    }
  }
}

// Start prewarming on module load (delayed to not block startup)
setTimeout(() => {
  prewarmCache().catch(err => {
    console.error('❌ Cache prewarming failed:', err.message);
  });
}, 2000); // Wait 2 seconds after server starts

console.log(`🔧 OHIF Proxy initialized with Orthanc URL: ${ORTHANC_URL}`);

// Viewer wrapper page
router.get('/viewer', logPerformance('VIEWER'), async (req, res) => {
  try {
    const studyUid = req.query.StudyInstanceUIDs;
    if (!studyUid) {
      return res.status(400).send('StudyInstanceUIDs parameter required');
    }

    console.log(`📺 Loading viewer for StudyInstanceUID: ${studyUid}`);

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>OHIF Viewer</title>
  <link rel="preload" href="/api/proxy/ohif/app.bundle.b34f32c5020ee27ad26.js" as="script">
  <link rel="preload" href="/api/proxy/ohif/app-config.js" as="script">
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
    src="/api/proxy/ohif/viewer?StudyInstanceUIDs=${studyUid}&token=${req.query.token}" 
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
    const cleanQuery = url.search;

    const cacheKey = `dicom-${req.method}-${path}${cleanQuery}`;

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

    const orthancUrl = `${ORTHANC_URL}/dicom-web/${path}${cleanQuery}`;

    console.log(`🔍 [DICOMweb] ${req.method} ${path.split('/').slice(-2).join('/')}`);

    const options = {
      method: req.method,
      headers: { 'Authorization': ORTHANC_AUTH },
      agent: keepAliveAgent,
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
          // If cache is full, just log and continue without caching
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
    const cleanQuery = url.search;

    const orthancUrl = `${ORTHANC_URL}/${path}${cleanQuery}`;

    console.log(`🔍 [Orthanc API] ${req.method} ${path.split('/').slice(0, 2).join('/')}`);

    const options = {
      method: req.method,
      headers: { 'Authorization': ORTHANC_AUTH },
      agent: keepAliveAgent
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

    const url = `${ORTHANC_URL}/ohif/${path}`;

    // Check config cache
    if (path.includes('app-config.js')) {
      const now = Date.now();
      if (configCache && (now - configCacheTime) < CONFIG_CACHE_TTL) {
        console.log(`💾 [OHIF] Serving cached config`);
        res.setHeader('Content-Type', 'application/javascript');
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.send(configCache);
      }
    }

    console.log(`📦 [OHIF] Fetching: ${path.split('/').pop()}`);

    const response = await fetchWithRetry(url, {
      headers: { 'Authorization': ORTHANC_AUTH },
      agent: keepAliveAgent
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

      if (path.includes('app-config.js')) {
        configCache = content;
        configCacheTime = Date.now();
        res.setHeader('Cache-Control', 'public, max-age=300');
        console.log(`💾 [OHIF] Config cached`);
      } else if (path === 'viewer') {
        resourceCache.set(cacheKey, {
          contentType,
          cacheControl: 'public, max-age=300',
          body: content
        }, 300);
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
        console.log(`💾 [OHIF] Cached ${path.split('/').pop()} (${(body.length / 1024).toFixed(2)}KB) in ${Date.now() - start}ms`);
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