const express = require('express');
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Verify token from query parameter (for iframe access)
const verifyTokenFromQuery = (req, res, next) => {
  try {
    const token = req.query.token;
    
    if (!token) {
      return res.status(401).send('Authentication required');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).send('Invalid or expired token');
  }
};

const ORTHANC_URL = process.env.ORTHANC_URL;
const ORTHANC_AUTH = 'Basic ' + Buffer.from(`${process.env.ORTHANC_USERNAME}:${process.env.ORTHANC_PASSWORD}`).toString('base64');

// Proxy OHIF viewer
router.get('/viewer', verifyTokenFromQuery, async (req, res) => {
  try {
    const studyUid = req.query.StudyInstanceUIDs;
    
    if (!studyUid) {
      return res.status(400).send('StudyInstanceUIDs parameter required');
    }

    // Fetch OHIF viewer HTML from Orthanc
    const response = await fetch(`${ORTHANC_URL}/ohif/viewer?StudyInstanceUIDs=${studyUid}`, {
      headers: {
        'Authorization': ORTHANC_AUTH
      }
    });

    if (!response.ok) {
      throw new Error(`Orthanc responded with ${response.status}`);
    }

    const html = await response.text();
    
    // Modify HTML to proxy all Orthanc requests through our backend
    const modifiedHtml = html
      .replace(/https?:\/\/[^/]+\/ohif/g, `${process.env.FRONTEND_URL || 'http://localhost:3000'}/api/proxy/ohif`)
      .replace(/https?:\/\/[^/]+\/(dicom-web|studies|series|instances)/g, `${process.env.FRONTEND_URL || 'http://localhost:3000'}/api/proxy/orthanc/$1`)
      .replace(
        '</head>',
        `<script>
          // Store token for API calls
          const RIS_TOKEN = '${req.query.token}';
          
          // Intercept fetch to add token to proxied requests
          const originalFetch = window.fetch;
          window.fetch = function(url, options = {}) {
            if (url.includes('/api/proxy/')) {
              const separator = url.includes('?') ? '&' : '?';
              url = url + separator + 'token=' + RIS_TOKEN;
            }
            return originalFetch(url, options);
          };
          
          // Intercept XMLHttpRequest
          const originalOpen = XMLHttpRequest.prototype.open;
          XMLHttpRequest.prototype.open = function(method, url, ...rest) {
            if (typeof url === 'string' && url.includes('/api/proxy/')) {
              const separator = url.includes('?') ? '&' : '?';
              url = url + separator + 'token=' + RIS_TOKEN;
            }
            return originalOpen.call(this, method, url, ...rest);
          };
        </script></head>`
      );

    res.setHeader('Content-Type', 'text/html');
    res.send(modifiedHtml);
  } catch (error) {
    console.error('OHIF proxy error:', error);
    res.status(500).send(`Failed to load OHIF viewer: ${error.message}`);
  }
});

// Proxy Orthanc API calls and resources
router.all('/orthanc/*', verifyTokenFromQuery, async (req, res) => {
  try {
    const path = req.params[0];
    const queryString = new URL(req.url, 'http://localhost').search;
    
    // Remove token from query string before forwarding to Orthanc
    const params = new URLSearchParams(queryString);
    params.delete('token');
    const cleanQuery = params.toString() ? `?${params.toString()}` : '';
    
    const url = `${ORTHANC_URL}/${path}${cleanQuery}`;

    const response = await fetch(url, {
      method: req.method,
      headers: {
        'Authorization': ORTHANC_AUTH,
        'Content-Type': req.headers['content-type'] || 'application/json'
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined
    });

    // Forward all headers from Orthanc
    response.headers.forEach((value, name) => {
      res.setHeader(name, value);
    });

    res.status(response.status);
    
    const buffer = await response.buffer();
    res.send(buffer);
  } catch (error) {
    console.error('Orthanc proxy error:', error);
    res.status(500).json({ error: 'Proxy request failed: ' + error.message });
  }
});

// Proxy OHIF static resources
router.get('/ohif/*', verifyTokenFromQuery, async (req, res) => {
  try {
    const path = req.params[0];
    const url = `${ORTHANC_URL}/ohif/${path}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': ORTHANC_AUTH
      }
    });

    response.headers.forEach((value, name) => {
      res.setHeader(name, value);
    });

    const buffer = await response.buffer();
    res.send(buffer);
  } catch (error) {
    console.error('OHIF resource proxy error:', error);
    res.status(500).send('Failed to load resource');
  }
});

module.exports = router;
