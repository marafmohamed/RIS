const express = require('express');
const fetch = require('node-fetch');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

const ORTHANC_URL = process.env.ORTHANC_URL;
const ORTHANC_AUTH = 'Basic ' + Buffer.from(`${process.env.ORTHANC_USERNAME}:${process.env.ORTHANC_PASSWORD}`).toString('base64');

// In-memory cache for study metadata (expires after 10 minutes)
const studyCache = new Map();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// Get study metadata only (fast, no image data)
router.get('/dicom-images/:studyUid', async (req, res) => {
  try {
    const { studyUid } = req.params;

    // Check cache first
    const cached = studyCache.get(studyUid);
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      return res.json(cached.data);
    }

    // Find study by StudyInstanceUID
    const findResponse = await fetch(`${ORTHANC_URL}/tools/find`, {
      method: 'POST',
      headers: {
        'Authorization': ORTHANC_AUTH,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        Level: 'Study',
        Query: {
          StudyInstanceUID: studyUid
        }
      })
    });

    const studies = await findResponse.json();
    
    if (studies.length === 0) {
      return res.status(404).json({ error: 'Study not found' });
    }

    const orthancStudyId = studies[0];

    // Get study details
    const studyResponse = await fetch(`${ORTHANC_URL}/studies/${orthancStudyId}`, {
      headers: { 'Authorization': ORTHANC_AUTH }
    });

    const studyData = await studyResponse.json();
    
    // Get all series with metadata only (no instance details yet)
    const series = [];
    let totalImages = 0;

    for (const seriesId of studyData.Series || []) {
      const seriesResponse = await fetch(`${ORTHANC_URL}/series/${seriesId}`, {
        headers: { 'Authorization': ORTHANC_AUTH }
      });
      const seriesData = await seriesResponse.json();
      
      const seriesInfo = seriesData.MainDicomTags || {};
      const instances = seriesData.Instances || [];
      
      series.push({
        id: seriesId,
        seriesNumber: parseInt(seriesInfo.SeriesNumber || series.length + 1),
        seriesDescription: seriesInfo.SeriesDescription || `Series ${series.length + 1}`,
        modality: seriesInfo.Modality || 'Unknown',
        numberOfInstances: instances.length,
        instanceIds: instances // Store IDs only, not full data
      });

      totalImages += instances.length;
    }

    // Sort series by series number
    series.sort((a, b) => a.seriesNumber - b.seriesNumber);

    const responseData = {
      studyId: orthancStudyId,
      studyInstanceUID: studyUid,
      patientName: studyData.PatientMainDicomTags?.PatientName || 'Unknown',
      patientID: studyData.PatientMainDicomTags?.PatientID || 'Unknown',
      studyDescription: studyData.MainDicomTags?.StudyDescription || 'Unknown',
      totalSeries: series.length,
      totalImages: totalImages,
      series: series
    };

    // Cache the result
    studyCache.set(studyUid, {
      data: responseData,
      timestamp: Date.now()
    });

    res.json(responseData);

  } catch (error) {
    console.error('Error fetching DICOM study metadata:', error);
    res.status(500).json({ error: 'Failed to fetch study metadata: ' + error.message });
  }
});

// Get instances for a specific series (lazy loaded)
router.get('/dicom-images/series/:seriesId/instances', async (req, res) => {
  try {
    const { seriesId } = req.params;

    const seriesResponse = await fetch(`${ORTHANC_URL}/series/${seriesId}`, {
      headers: { 'Authorization': ORTHANC_AUTH }
    });
    const seriesData = await seriesResponse.json();
    
    const instances = seriesData.Instances || [];
    const instanceDetails = [];

    for (const instanceId of instances) {
      const instanceResponse = await fetch(`${ORTHANC_URL}/instances/${instanceId}`, {
        headers: { 'Authorization': ORTHANC_AUTH }
      });
      const instanceData = await instanceResponse.json();
      const tags = instanceData.MainDicomTags || {};
      
      instanceDetails.push({
        id: instanceId,
        instanceNumber: parseInt(tags.InstanceNumber || instanceDetails.length + 1),
        imageUrl: `${ORTHANC_URL}/instances/${instanceId}/preview`,
        sopInstanceUID: tags.SOPInstanceUID || ''
      });
    }

    // Sort by instance number
    instanceDetails.sort((a, b) => a.instanceNumber - b.instanceNumber);

    res.json({ instances: instanceDetails });

  } catch (error) {
    console.error('Error fetching series instances:', error);
    res.status(500).json({ error: 'Failed to fetch instances: ' + error.message });
  }
});

// Proxy individual image
router.get('/image/:instanceId', async (req, res) => {
  try {
    const { instanceId } = req.params;
    const type = req.query.type || 'preview'; // preview, image-uint8, image-uint16

    const response = await fetch(`${ORTHANC_URL}/instances/${instanceId}/${type}`, {
      headers: { 'Authorization': ORTHANC_AUTH }
    });

    if (!response.ok) {
      throw new Error(`Orthanc responded with ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day

    const buffer = await response.buffer();
    res.send(buffer);

  } catch (error) {
    console.error('Error proxying image:', error);
    res.status(500).send('Failed to load image');
  }
});

module.exports = router;
