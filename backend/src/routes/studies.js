const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const orthancService = require('../services/orthancService');
const Report = require('../models/Report');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Get all studies with report status
router.get('/', async (req, res) => {
  try {
    const { patientName, patientId, startDate, endDate } = req.query;

    let orthancStudies = [];

    // Search based on query parameters
    if (patientName) {
      orthancStudies = await orthancService.searchStudiesByPatientName(patientName);
    } else if (patientId) {
      orthancStudies = await orthancService.searchStudiesByPatientID(patientId);
    } else if (startDate || endDate) {
      orthancStudies = await orthancService.searchStudiesByDate(startDate, endDate);
    } else {
      // Default: get studies from last 30 days
      const today = new Date();
      const thirtyDaysAgo = new Date(today.setDate(today.getDate() - 30));
      const startDateStr = thirtyDaysAgo.toISOString().split('T')[0];
      orthancStudies = await orthancService.searchStudiesByDate(startDateStr, null);
    }

    // Parse Orthanc studies
    const studies = orthancStudies.map(study => orthancService.parseStudy(study));

    // Get all reports for these studies
    const studyUids = studies.map(s => s.studyInstanceUid);
    
    // Build report filter
    const reportFilter = { studyInstanceUid: { $in: studyUids } };
    
    // For non-admin users, also get their own reports to show in worklist
    // This way they can see which patients they're working on
    if (req.user.role !== 'ADMIN') {
      reportFilter.authorId = req.user._id;
    }
    
    const reports = await Report.find(reportFilter)
      .select('studyInstanceUid status authorName authorId updatedAt');

    // Create a map of studyUid -> report
    const reportMap = {};
    reports.forEach(report => {
      reportMap[report.studyInstanceUid] = {
        status: report.status,
        authorName: report.authorName,
        updatedAt: report.updatedAt
      };
    });

    // Merge study data with report status
    const studiesWithStatus = studies.map(study => {
      const report = reportMap[study.studyInstanceUid];
      return {
        ...study,
        reportStatus: report?.status || 'UNREPORTED',
        reportAuthor: report?.authorName || null,
        reportUpdatedAt: report?.updatedAt || null,
        reportAuthorId: report?.authorId || null
      };
    });
    
    // For non-admin users, filter to show:
    // 1. Studies with no reports (UNREPORTED)
    // 2. Studies with reports by the current user
    let filteredStudies = studiesWithStatus;
    if (req.user.role !== 'ADMIN') {
      filteredStudies = studiesWithStatus.filter(study => 
        study.reportStatus === 'UNREPORTED' || 
        study.reportAuthorId?.toString() === req.user._id.toString()
      );
    }

    // Sort by study date (newest first)
    filteredStudies.sort((a, b) => {
      if (!a.studyDate) return 1;
      if (!b.studyDate) return -1;
      return new Date(b.studyDate) - new Date(a.studyDate);
    });

    res.json(filteredStudies);
  } catch (error) {
    console.error('Get studies error:', error);
    res.status(500).json({ error: 'Failed to fetch studies from PACS' });
  }
});

// Get specific study details
router.get('/:studyUid', async (req, res) => {
  try {
    const { studyUid } = req.params;

    // Find the study in Orthanc by StudyInstanceUID
    const searchResults = await orthancService.findStudies({
      StudyInstanceUID: studyUid
    });

    if (searchResults.length === 0) {
      return res.status(404).json({ error: 'Study not found in PACS' });
    }

    const orthancStudy = searchResults[0];
    const study = orthancService.parseStudy(orthancStudy);

    // Get report if exists
    const report = await Report.findOne({ studyInstanceUid: studyUid });

    res.json({
      ...study,
      report: report || null
    });
  } catch (error) {
    console.error('Get study details error:', error);
    res.status(500).json({ error: 'Failed to fetch study details' });
  }
});

// Test Orthanc connection
router.get('/test/connection', async (req, res) => {
  try {
    const systemInfo = await orthancService.getSystemInfo();
    res.json({
      connected: true,
      version: systemInfo.Version,
      name: systemInfo.Name
    });
  } catch (error) {
    res.status(500).json({
      connected: false,
      error: error.message
    });
  }
});

module.exports = router;
