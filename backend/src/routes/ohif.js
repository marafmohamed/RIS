const express = require('express');
const router = express.Router();
const axios = require('axios');
const Settings = require('../models/Settings');
const auth = require('../middleware/auth');

// Proxy endpoint for OHIF viewer
// This handles authentication with Orthanc server-side to avoid CORS issues
router.get('/viewer', auth, async (req, res) => {
  try {
    const { StudyInstanceUIDs } = req.query;
    
    if (!StudyInstanceUIDs) {
      return res.status(400).json({ error: 'StudyInstanceUIDs parameter is required' });
    }

    // Get Orthanc credentials from settings
    const settings = await Settings.findOne();
    if (!settings || !settings.orthancUrl || !settings.orthancUsername || !settings.orthancPassword) {
      return res.status(500).json({ error: 'Orthanc credentials not configured' });
    }

    // Build OHIF URL with our backend as the data source
    // OHIF will make requests back to our backend, which will proxy to Orthanc with auth
    const ohifUrl = `${settings.orthancUrl}/ohif/viewer?StudyInstanceUIDs=${StudyInstanceUIDs}`;
    
    // Return the URL for the frontend to use
    res.json({ 
      viewerUrl: ohifUrl,
      message: 'Use this URL to load OHIF viewer'
    });
  } catch (error) {
    console.error('OHIF viewer proxy error:', error);
    res.status(500).json({ error: 'Failed to generate viewer URL' });
  }
});

// Proxy endpoint for Orthanc system info (for pre-authentication)
router.get('/orthanc-auth', auth, async (req, res) => {
  try {
    // Get Orthanc credentials from settings
    const settings = await Settings.findOne();
    if (!settings || !settings.orthancUrl || !settings.orthancUsername || !settings.orthancPassword) {
      return res.status(500).json({ error: 'Orthanc credentials not configured' });
    }

    // Make authenticated request to Orthanc system endpoint
    const response = await axios.get(`${settings.orthancUrl}/system`, {
      auth: {
        username: settings.orthancUsername,
        password: settings.orthancPassword
      }
    });

    // Return success with Orthanc version info
    res.json({
      success: true,
      version: response.data.Version,
      message: 'Authentication successful'
    });
  } catch (error) {
    console.error('Orthanc authentication error:', error.message);
    res.status(error.response?.status || 500).json({ 
      error: 'Failed to authenticate with Orthanc',
      details: error.message
    });
  }
});

module.exports = router;
