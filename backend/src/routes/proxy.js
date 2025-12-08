const express = require("express");
const fetch = require("node-fetch");
const jwt = require("jsonwebtoken");
const NodeCache = require("node-cache");
const dns = require("dns").promises; // Kept from original
const stream = require("stream");
const { promisify } = require("util");
const http = require("http");
const https = require("https");
const compression = require("compression");
const Clinic = require("../models/Clinic");
const { decrypt } = require("../utils/encryption");

const router = express.Router();

// 1. ENABLE COMPRESSION
router.use(compression());

// 2. SMART CACHING
const metadataCache = new NodeCache({
  stdTTL: 600,
  checkperiod: 60,
  useClones: false,
  maxKeys: 1000,
});

// 3. OPTIMIZED HTTP AGENT
const connectionSettings = {
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 1000,
  maxFreeSockets: 50,
  timeout: 30000,
  scheduling: "fifo",
};

const httpAgent = new http.Agent(connectionSettings);
const httpsAgent = new https.Agent(connectionSettings);

// DNS Cache (Kept from original, though standard Agent handles DNS usually)
const dnsCache = new Map();
const DNS_CACHE_TTL = 300 * 1000;

// --- HELPER FUNCTIONS ---

async function getOrthancConfig(specificClinicId) {
  // Default Config
  let config = {
    url: process.env.ORTHANC_URL,
    username: process.env.ORTHANC_USERNAME,
    password: process.env.ORTHANC_PASSWORD,
  };

  // Override if Clinic ID is provided
  if (specificClinicId) {
    try {
      const clinic = await Clinic.findById(specificClinicId);
      if (clinic && clinic.orthancUrl) {
        config = {
          url: clinic.orthancUrl,
          username: clinic.orthancUsername,
          password: decrypt(clinic.orthancPassword),
        };
      }
    } catch (error) {
      console.error("Error fetching clinic config:", error);
    }
  }

  const auth =
    "Basic " +
    Buffer.from(`${config.username}:${config.password}`).toString("base64");
  const agent = config.url.startsWith("https") ? httpsAgent : httpAgent;

  return { ...config, auth, agent };
}

async function fetchWithRetry(url, options, maxRetries = 2) {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fetch(url, options);
    } catch (err) {
      if (i === maxRetries) throw err;
      await new Promise((r) => setTimeout(r, 200 * (i + 1)));
    }
  }
}

// --- ROUTES ---

// 1. VIEWER HTML WRAPPER (Entry point)
router.get("/viewer", async (req, res) => {
  try {
    const studyUid = req.query.StudyInstanceUIDs;
    const clinicId = req.query.clinicId || "";

    if (!studyUid) {
      return res.status(400).send("StudyInstanceUIDs parameter required");
    }

    console.log(
      `📺 Loading viewer wrapper for Study: ${studyUid} (Clinic: ${clinicId})`
    );

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>OHIF Viewer</title>
  <style>
    body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #000; }
    iframe { border: 0; width: 100%; height: 100%; }
    .loader {
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      color: white; font-family: sans-serif;
    }
  </style>
</head>
<body>
  <div class="loader" id="loader">Loading...</div>
  <iframe
    id="ohif"
    src="/api/proxy/ohif/viewer?StudyInstanceUIDs=${studyUid}&token=${req.query.token}&clinicId=${clinicId}"
    allow="fullscreen"
    style="display:none"
  ></iframe>
  <script>
    const iframe = document.getElementById('ohif');
    iframe.onload = () => {
      document.getElementById('loader').style.display = 'none';
      iframe.style.display = 'block';
    };
  </script>
</body>
</html>`;

    res.send(html);
  } catch (error) {
    console.error("❌ OHIF proxy error:", error);
    res.status(500).send(`Failed to load OHIF viewer: ${error.message}`);
  }
});

// 2. EXPORT DICOM (ZIP)
router.get("/export-dicom", async (req, res) => {
  try {
    const { studyUid, clinicId } = req.query;
    if (!studyUid)
      return res.status(400).json({ error: "Missing studyUid parameter" });

    const config = await getOrthancConfig(clinicId);

    // Lookup internal ID
    const lookupRes = await fetchWithRetry(`${config.url}/tools/lookup`, {
      method: "POST",
      body: studyUid,
      headers: { Authorization: config.auth, "Content-Type": "text/plain" },
      agent: config.agent,
    });

    if (!lookupRes.ok)
      throw new Error(`Lookup failed: ${lookupRes.statusText}`);
    const lookupData = await lookupRes.json();
    const studyData = lookupData.find((item) => item.Type === "Study");

    if (!studyData)
      return res.status(404).json({ error: "Study not found on PACS" });

    // Stream Zip
    const archiveRes = await fetch(
      `${config.url}/studies/${studyData.ID}/archive`,
      {
        method: "GET",
        headers: { Authorization: config.auth },
        agent: config.agent,
        timeout: 300000,
      }
    );

    if (!archiveRes.ok)
      throw new Error(`Archive generation failed: ${archiveRes.statusText}`);

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Study-${studyUid}.zip"`
    );
    archiveRes.body.pipe(res);
  } catch (error) {
    console.error(`❌ [EXPORT] Error: ${error.message}`);
    if (!res.headersSent)
      res
        .status(500)
        .json({ error: "Failed to export study", details: error.message });
  }
});

// 3. DICOM WEB PROXY (High Performance & Path Fixed)
router.all("/dicom-web/*", async (req, res) => {
  try {
    let path = req.params[0];
    let clinicId = req.query.clinicId;

    // === PATH EXTRACTION FIX ===
    // If URL is /dicom-web/c/12345/studies/..., extract 12345 and clean path
    const pathMatch = path.match(/^c\/([^\/]+)\/(.*)$/);
    if (pathMatch) {
      clinicId = pathMatch[1];
      path = pathMatch[2];
    }

    const url = new URL(req.url, "http://localhost");
    url.searchParams.delete("token");
    url.searchParams.delete("clinicId");
    const cleanQuery = url.search;

    const cacheKey = `meta-${clinicId || "def"}-${path}${cleanQuery}`;
    const isFrameRequest = path.includes("/frames/");

    // A. RAM CACHE (Metadata)
    if (req.method === "GET" && !isFrameRequest) {
      const cached = metadataCache.get(cacheKey);
      if (cached) {
        res.status(cached.status);
        Object.entries(cached.headers).forEach(([k, v]) => res.setHeader(k, v));
        return res.send(cached.body);
      }
    }

    const config = await getOrthancConfig(clinicId);
    const orthancUrl = `${config.url}/dicom-web/${path}${cleanQuery}`;

    // B. FETCH
    const response = await fetchWithRetry(orthancUrl, {
      method: req.method,
      headers: {
        Authorization: config.auth,
        Accept: req.headers["accept"] || "application/json",
        "Content-Type": req.headers["content-type"],
      },
      body:
        req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
      agent: config.agent,
    });

    if (!response.ok && response.status !== 304) {
      console.error(`❌ [DICOMweb] Failed: ${response.status} ${path}`);
    }

    // C. HEADERS & STREAMING
    res.status(response.status);
    const passHeaders = [
      "content-type",
      "content-length",
      "last-modified",
      "etag",
      "multipart-related",
      "content-range",
    ];
    passHeaders.forEach((h) => {
      if (response.headers.get(h)) res.setHeader(h, response.headers.get(h));
    });

    if (isFrameRequest) {
      // Images: Stream + Immutable Cache
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      response.body.pipe(res);
    } else {
      // Metadata: Buffer + RAM Cache
      const body = await response.buffer();

      if (req.method === "GET" && response.ok) {
        res.setHeader(
          "Cache-Control",
          "public, max-age=60, stale-while-revalidate=300"
        );
        const headers = {};
        passHeaders.forEach((h) => {
          if (response.headers.get(h)) headers[h] = response.headers.get(h);
        });
        metadataCache.set(cacheKey, { status: response.status, headers, body });
      }
      res.send(body);
    }
  } catch (error) {
    if (error.code !== "ECONNRESET") {
      console.error(`❌ [DICOMweb] Error: ${error.message}`);
      if (!res.headersSent) res.status(500).end();
    }
  }
});

// 4. ORTHANC REST API (Backward compatibility)
router.all("/orthanc/*", async (req, res) => {
  try {
    const config = await getOrthancConfig(req.query.clinicId);

    // Remove internal tokens
    const url = new URL(req.url, "http://h");
    url.searchParams.delete("token");
    url.searchParams.delete("clinicId");

    const orthancUrl = `${config.url}/${req.params[0]}${url.search}`;

    const response = await fetchWithRetry(orthancUrl, {
      method: req.method,
      headers: {
        Authorization: config.auth,
        "Content-Type": req.headers["content-type"],
      },
      body: req.method !== "GET" ? req.body : undefined,
      agent: config.agent,
    });

    res.status(response.status);
    response.body.pipe(res);
  } catch (error) {
    console.error(`❌ [Orthanc API] Error: ${error.message}`);
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
});

// 5. OHIF STATIC ASSETS (With JWT Check & Config Rewrite)
router.get("/ohif/*", async (req, res) => {
  try {
    const path = req.params[0];
    let clinicId = req.query.clinicId;

    if (path.endsWith(".map")) return res.status(404).end();

    // === JWT SECURITY CHECK (Restored from Original) ===
    const requiresAuth = path === "viewer" || path.includes(".html");
    if (requiresAuth) {
      const token = req.query.token;
      if (!token) {
        return res.status(401).send("Authentication required");
      }
      try {
        jwt.verify(token, process.env.JWT_SECRET);
      } catch (error) {
        console.error("❌ Token verification failed:", error.message);
        return res.status(401).send("Invalid or expired token");
      }
    }

    // Fallback ID from Referer
    if (!clinicId && req.headers.referer) {
      try {
        const refererUrl = new URL(req.headers.referer);
        clinicId = refererUrl.searchParams.get("clinicId");
      } catch (e) {}
    }

    const config = await getOrthancConfig(clinicId);

    const response = await fetchWithRetry(`${config.url}/ohif/${path}`, {
      headers: { Authorization: config.auth },
      agent: config.agent,
    });

    if (!response.ok)
      return res.status(response.status).send("Resource not found");

    res.setHeader(
      "Content-Type",
      response.headers.get("content-type") || "application/octet-stream"
    );

    // === CONFIG REWRITE LOGIC ===
    if (
      path.includes("app-config.js") ||
      path.includes("viewer") ||
      path.endsWith(".html")
    ) {
      let content = await response.text();
      const clinicParam = clinicId ? `?clinicId=${clinicId}` : "";

      // 1. Rewrite <script src="app-config.js"> to include clinicId query param
      if (path.includes("viewer") || path.endsWith(".html")) {
        content = content.replace(
          /src=["']app-config\.js["']/g,
          `src="app-config.js${clinicParam}"`
        );
      }

      // 2. Rewrite base paths
      content = content
        .replace(/<base href="\/ohif\/?"/g, '<base href="/api/proxy/ohif/"')
        .replace(/"\/ohif\//g, '"/api/proxy/ohif/')
        .replace(/'\/ohif\//g, "'/api/proxy/ohif/")
        .replace(/["']\/dicom-web/g, '"/api/proxy/dicom-web');

      // 3. REWRITE DICOM ROOTS (Use Path-based ID, not Query)
      if (path.includes("app-config.js")) {
        // Creates path like: /api/proxy/dicom-web/c/CLINIC_ID
        const proxyRoot = clinicId
          ? `/api/proxy/dicom-web/c/${clinicId}`
          : `/api/proxy/dicom-web`;

        content = content
          .replace(/wadoRoot:\s*['"][^'"]+['"]/g, `wadoRoot: '${proxyRoot}'`)
          .replace(/qidoRoot:\s*['"][^'"]+['"]/g, `qidoRoot: '${proxyRoot}'`)
          .replace(
            /wadoUriRoot:\s*['"][^'"]+['"]/g,
            `wadoUriRoot: '${proxyRoot}'`
          );

        res.setHeader("Cache-Control", "no-cache");
      } else {
        // Viewer HTML caching
        res.setHeader("Cache-Control", "public, max-age=300");
      }

      res.send(content);
    } else {
      // Static assets
      res.setHeader("Cache-Control", "public, max-age=86400, immutable");
      response.body.pipe(res);
    }
  } catch (error) {
    console.error(`❌ [OHIF] Asset error: ${error.message}`);
    if (!res.headersSent) res.status(500).send("Failed to load resource");
  }
});

// Catch-all
router.all("*", (req, res) => {
  console.error(`❌ [404] Route not found: ${req.method} ${req.path}`);
  res.status(404).json({ error: "Route not found", path: req.path });
});

module.exports = router;
