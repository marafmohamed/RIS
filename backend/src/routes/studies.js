const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const OrthancService = require('../services/orthancService');
const Report = require('../models/Report');
const Clinic = require('../models/Clinic');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Helper to get Orthanc service instance
async function getOrthancService(clinicId, user) {
  // Security Check: If user is not ADMIN, check if they have access to this clinic
  if (user && user.role !== 'ADMIN' && clinicId) {
    const allowedIds = (user.allowedClinics || []).map(id => id.toString());
    if (!allowedIds.includes(clinicId)) {
      throw new Error('ACCESS_DENIED');
    }
  }

  if (clinicId) {
    const clinic = await Clinic.findById(clinicId);
    if (clinic) {
      return OrthancService.fromClinic(clinic);
    }
  }

  // Try to find default clinic
  const defaultClinic = await Clinic.findOne({ isDefault: true });
  if (defaultClinic) {
    return OrthancService.fromClinic(defaultClinic);
  }

  // Fallback to env vars
  return new OrthancService();
}

// Get all studies with report status
router.get('/', async (req, res) => {
  try {
    const { patientName, patientId, startDate, endDate, clinicId, modality } = req.query;

    const orthancService = await getOrthancService(clinicId, req.user);
    let orthancStudies = [];

    // 1. Search Orthanc based on query parameters
    if (patientName) {
      orthancStudies = await orthancService.searchStudiesByPatientName(patientName);
    } else if (patientId) {
      orthancStudies = await orthancService.searchStudiesByPatientID(patientId);
    } else if (startDate || endDate) {
      orthancStudies = await orthancService.searchStudiesByDate(startDate, endDate);
    } else {
      // Default: get all studies (no date restriction)
      // Previous behavior limited to 30 days which could hide older studies
      orthancStudies = await orthancService.findStudies({});
    }

    // 2. Parse Studies using the Service
    // The service handles ModalitiesInStudy array and Age calculation internally now
    let studies = orthancStudies.map(rawStudy => orthancService.parseStudy(rawStudy));

    // 3. Filter by Modality (Backend Side)
    // Orthanc doesn't support filtering by modality in the search API easily, so we filter the results here
    if (modality) {
      studies = studies.filter(s =>
        s.modality && s.modality.includes(modality)
      );
    }

    // 4. Get all reports for these studies to merge status
    const studyUids = studies.map(s => s.studyInstanceUid);

    // Build report filter based on user role
    const reportFilter = { studyInstanceUid: { $in: studyUids } };

    // VIEWER and REFERRING_PHYSICIAN: Only see FINAL reports (no author filter)
    // RADIOLOGIST: Only see their own reports
    // ADMIN: See all reports
    if (req.user.role === 'VIEWER' || req.user.role === 'REFERRING_PHYSICIAN') {
      reportFilter.status = 'FINAL';
    } else if (req.user.role !== 'ADMIN') {
      reportFilter.authorId = req.user._id;
    }

    const reports = await Report.find(reportFilter)
      .select('studyInstanceUid status authorName authorId updatedAt assignedTo assignedBy assignedAt validatedBy ratings averageRating validationCount')
      .populate('assignedTo', 'fullName')
      .populate('assignedBy', 'fullName');

    // Create a map of studyUid -> report for O(1) lookup
    const reportMap = {};
    reports.forEach(report => {
      reportMap[report.studyInstanceUid] = {
        status: report.status,
        authorName: report.authorName,
        updatedAt: report.updatedAt,
        authorId: report.authorId,
        assignedTo: report.assignedTo,
        assignedBy: report.assignedBy,
        assignedAt: report.assignedAt,
        validatedBy: report.validatedBy,
        ratings: report.ratings,
        averageRating: report.averageRating,
        validationCount: report.validationCount
      };
    });
    // 5. Merge study data with report status
    let studiesWithStatus = studies.map(study => {
      const report = reportMap[study.studyInstanceUid];
      return {
        ...study,
        reportStatus: report?.status || 'UNREPORTED',
        reportAuthor: report?.authorName || null,
        reportUpdatedAt: report?.updatedAt || null,
        reportAuthorId: report?.authorId || null,
        assignedTo: report?.assignedTo || null,
        assignedBy: report?.assignedBy || null,
        assignedAt: report?.assignedAt || null,
        validatedBy: report?.validatedBy || [],
        ratings: report?.ratings || [],
        averageRating: report?.averageRating || 0,
        validationCount: report?.validationCount || 0
      };
    });

    // 6. Role based final filtering
    if (req.user.role === 'VIEWER' || req.user.role === 'REFERRING_PHYSICIAN') {
      // Only show studies with FINAL reports
      studiesWithStatus = studiesWithStatus.filter(study =>
        study.reportStatus === 'FINAL'
      );
    } else if (req.user.role !== 'ADMIN') {
      // RADIOLOGIST: Show unreported studies or their own reports or assigned studies
      studiesWithStatus = studiesWithStatus.filter(study =>
        study.reportStatus === 'UNREPORTED' ||
        study.reportAuthorId?.toString() === req.user._id.toString() ||
        study.assignedTo?._id?.toString() === req.user._id.toString()
      );
    }

    // 7. Sort by study date (newest first)
    studiesWithStatus.sort((a, b) => {
      if (!a.studyDate) return 1;
      if (!b.studyDate) return -1;
      return new Date(b.studyDate) - new Date(a.studyDate);
    });

    res.json(studiesWithStatus);
  } catch (error) {
    if (error.message === 'ACCESS_DENIED') {
      return res.status(403).json({ error: 'You do not have access to this clinic' });
    }
    console.error('Get studies error:', error);
    res.status(500).json({ error: 'Failed to fetch studies from PACS' });
  }
});

// Get specific study details
router.get('/:studyUid', async (req, res) => {
  try {
    const { studyUid } = req.params;
    const { clinicId } = req.query;

    const orthancService = await getOrthancService(clinicId, req.user);

    // Find the study in Orthanc by StudyInstanceUID
    const searchResults = await orthancService.findStudies({
      StudyInstanceUID: studyUid
    });

    if (searchResults.length === 0) {
      return res.status(404).json({ error: 'Study not found in PACS' });
    }

    const orthancStudy = searchResults[0];

    // Use the Service parser here too
    const study = orthancService.parseStudy(orthancStudy);

    // Get report if exists
    const report = await Report.findOne({ studyInstanceUid: studyUid });

    res.json({
      ...study,
      report: report || null
    });
  } catch (error) {
    if (error.message === 'ACCESS_DENIED') {
      return res.status(403).json({ error: 'You do not have access to this clinic' });
    }
    console.error('Get study details error:', error);
    res.status(500).json({ error: 'Failed to fetch study details' });
  }
});

// Test Orthanc connection
router.get('/test/connection', async (req, res) => {
  try {
    const { clinicId } = req.query;
    const orthancService = await getOrthancService(clinicId, req.user);

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