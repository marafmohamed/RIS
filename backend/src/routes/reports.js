const express = require('express');
const { body, validationResult } = require('express-validator');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const Report = require('../models/Report');
const User = require('../models/User');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Get all reports
router.get('/', async (req, res) => {
  try {
    const { status, startDate, endDate } = req.query;

    const filter = {};

    // Non-admin users only see their own reports
    // REFERRING_PHYSICIAN and VIEWER can only see FINAL reports
    if (req.user.role === 'REFERRING_PHYSICIAN' || req.user.role === 'VIEWER') {
      filter.status = 'FINAL';
    } else if (req.user.role !== 'ADMIN') {
      filter.authorId = req.user._id;
    }

    if (status) {
      filter.status = status;
    }

    if (startDate || endDate) {
      filter.studyDate = {};
      if (startDate) filter.studyDate.$gte = new Date(startDate);
      if (endDate) filter.studyDate.$lte = new Date(endDate);
    }

    const reports = await Report.find(filter)
      .populate('authorId', 'fullName email')
      .sort({ updatedAt: -1 });

    res.json(reports);
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// Get report by study UID
router.get('/study/:studyUid', async (req, res) => {
  try {
    const report = await Report.findOne({ studyInstanceUid: req.params.studyUid })
      .populate('authorId', 'fullName email');

    if (!report) {
      return res.status(404).json({ data: null });
    }

    res.json({ data: report });
  } catch (error) {
    console.error('Get report error:', error);
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

// Create new report
router.post('/', [
  body('studyInstanceUid').notEmpty(),
  body('patientName').notEmpty(),
  body('patientId').notEmpty(),
  body('studyDate').isISO8601()
], async (req, res) => {
  try {
    // VIEWER and REFERRING_PHYSICIAN roles cannot create reports
    if (req.user.role === 'VIEWER' || req.user.role === 'REFERRING_PHYSICIAN') {
      return res.status(403).json({ error: 'You cannot create reports' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      studyInstanceUid,
      patientName,
      patientId,
      studyDate,
      modality,
      studyDescription,
      content,
      status
    } = req.body;

    // Check if report already exists
    const existingReport = await Report.findOne({ studyInstanceUid });
    if (existingReport) {
      return res.status(400).json({ error: 'Report already exists for this study' });
    }

    // Create report
    const report = await Report.create({
      studyInstanceUid,
      patientName,
      patientId,
      studyDate: new Date(studyDate),
      modality: modality || '',
      studyDescription: studyDescription || '',
      content: content || '',
      status: status || 'DRAFT',
      authorId: req.user._id,
      authorName: req.user.fullName
    });

    res.status(201).json({
      message: 'Report created successfully',
      report
    });
  } catch (error) {
    console.error('Create report error:', error);
    res.status(500).json({ error: 'Failed to create report' });
  }
});

// Update report
router.put('/:id', async (req, res) => {
  try {
    // VIEWER and REFERRING_PHYSICIAN roles cannot update reports
    if (req.user.role === 'VIEWER' || req.user.role === 'REFERRING_PHYSICIAN') {
      return res.status(403).json({ error: 'You cannot modify reports' });
    }

    const { content, status } = req.body;

    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Permission checks
    const isAuthor = report.authorId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'ADMIN';

    // Only the author or admin can edit draft reports
    if (report.status === 'DRAFT' && !isAuthor && !isAdmin) {
      return res.status(403).json({ error: 'You can only edit your own draft reports' });
    }

    // Final reports can only be edited by admins
    if (report.status === 'FINAL' && !isAdmin) {
      return res.status(403).json({ error: 'Only admins can edit finalized reports' });
    }

    if (content !== undefined) report.content = content;
    if (status) report.status = status;

    await report.save();

    res.json({
      message: 'Report updated successfully',
      report
    });
  } catch (error) {
    console.error('Update report error:', error);
    res.status(500).json({ error: 'Failed to update report' });
  }
});

// Delete report (Admin only)
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    const report = await Report.findByIdAndDelete(req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json({ message: 'Report deleted successfully' });
  } catch (error) {
    console.error('Delete report error:', error);
    res.status(500).json({ error: 'Failed to delete report' });
  }
});

// Get statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const totalReports = await Report.countDocuments();
    const draftReports = await Report.countDocuments({ status: 'DRAFT' });
    const finalReports = await Report.countDocuments({ status: 'FINAL' });

    // Reports by user
    const reportsByUser = await Report.aggregate([
      {
        $group: {
          _id: '$authorId',
          count: { $sum: 1 },
          authorName: { $first: '$authorName' }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    res.json({
      total: totalReports,
      draft: draftReports,
      final: finalReports,
      byUser: reportsByUser
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Validate report (REFERRING_PHYSICIAN, ADMIN)
router.post('/:id/validate', async (req, res) => {
  try {
    const { feedback } = req.body;

    // Only REFERRING_PHYSICIAN and ADMIN can validate
    if (req.user.role !== 'REFERRING_PHYSICIAN' && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only referring physicians can validate reports' });
    }

    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Can only validate FINAL reports
    if (report.status !== 'FINAL') {
      return res.status(400).json({ error: 'Only finalized reports can be validated' });
    }

    // Check if already validated by this user
    const alreadyValidated = report.validatedBy.some(
      v => v.userId.toString() === req.user._id.toString()
    );

    if (alreadyValidated) {
      return res.status(400).json({ error: 'You have already validated this report' });
    }

    // Add validation
    report.validatedBy.push({
      userId: req.user._id,
      userName: req.user.fullName,
      validatedAt: new Date(),
      feedback: feedback || ''
    });

    report.validationCount = report.validatedBy.length;
    await report.save();

    res.json({
      message: 'Report validated successfully',
      report
    });
  } catch (error) {
    console.error('Validate report error:', error);
    res.status(500).json({ error: 'Failed to validate report' });
  }
});

// Rate report (REFERRING_PHYSICIAN, ADMIN)
router.post('/:id/rate', [
  body('rating').isInt({ min: 1, max: 5 }),
  body('comment').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { rating, comment } = req.body;

    // Only REFERRING_PHYSICIAN and ADMIN can rate
    if (req.user.role !== 'REFERRING_PHYSICIAN' && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only referring physicians can rate reports' });
    }

    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Can only rate FINAL reports
    if (report.status !== 'FINAL') {
      return res.status(400).json({ error: 'Only finalized reports can be rated' });
    }

    // Check if already rated by this user
    const existingRatingIndex = report.ratings.findIndex(
      r => r.userId.toString() === req.user._id.toString()
    );

    if (existingRatingIndex >= 0) {
      // Update existing rating
      report.ratings[existingRatingIndex] = {
        userId: req.user._id,
        userName: req.user.fullName,
        rating,
        comment: comment || '',
        ratedAt: new Date()
      };
    } else {
      // Add new rating
      report.ratings.push({
        userId: req.user._id,
        userName: req.user.fullName,
        rating,
        comment: comment || '',
        ratedAt: new Date()
      });
    }

    // Calculate average rating
    const totalRating = report.ratings.reduce((sum, r) => sum + r.rating, 0);
    report.averageRating = report.ratings.length > 0 ? totalRating / report.ratings.length : 0;

    await report.save();

    res.json({
      message: 'Report rated successfully',
      report
    });
  } catch (error) {
    console.error('Rate report error:', error);
    res.status(500).json({ error: 'Failed to rate report' });
  }
});

// Get validated reports for current user
router.get('/validated/me', async (req, res) => {
  try {
    const reports = await Report.find({
      'validatedBy.userId': req.user._id
    })
      .populate('authorId', 'fullName email')
      .sort({ updatedAt: -1 });

    res.json(reports);
  } catch (error) {
    console.error('Get validated reports error:', error);
    res.status(500).json({ error: 'Failed to fetch validated reports' });
  }
});

// Assign study to radiologist (Admin only)
router.post('/assign', adminOnly, async (req, res) => {
  try {
    // 1. Destructure ALL required fields from the body
    const { 
      studyInstanceUid, 
      radiologistId, 
      patientName, 
      patientId, 
      studyDate,
      modality,
      studyDescription
    } = req.body;

    console.log('Assign Request Body:', req.body);

    if (!studyInstanceUid || !radiologistId) {
      return res.status(400).json({ error: 'Study UID and radiologist ID are required' });
    }

    // Check if report exists
    let report = await Report.findOne({ studyInstanceUid });

    if (!report) {
      // 2. Validate required fields for NEW report creation
      if (!patientName || !patientId || !studyDate) {
         return res.status(400).json({ 
           error: 'Missing patient details (name, id, date) required to create a new report assignment.' 
         });
      }

      const radiologist = await User.findById(radiologistId);
      if (!radiologist) {
        return res.status(404).json({ error: 'Radiologist not found' });
      }

      // 3. Create report with all details
      report = new Report({
        studyInstanceUid,
        status: 'ASSIGNED',
        assignedTo: radiologistId,
        assignedBy: req.user._id,
        assignedAt: new Date(),
        authorId: radiologistId,
        authorName: radiologist.fullName,
        // Map the fields from request body to Schema
        patientName,
        patientId,
        studyDate,
        modality: modality || '',
        studyDescription: studyDescription || ''
      });
    } else {
      // Update existing report assignment
      report.assignedTo = radiologistId;
      report.assignedBy = req.user._id;
      report.assignedAt = new Date();
      report.status = report.status === 'DRAFT' ? 'DRAFT' : 'ASSIGNED'; // Keep draft if already started
    }

    await report.save();

    res.json({
      message: 'Study assigned successfully',
      report
    });
  } catch (error) {
    console.error('Assign study error:', error);
    // Send the specific validation error message back if available
    res.status(500).json({ error: error.message || 'Failed to assign study' });
  }
});

// Download report as PDF
router.get('/download/:id/pdf', async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Only allow download of finalized reports
    if (report.status !== 'FINAL') {
      return res.status(403).json({ error: 'Only finalized reports can be downloaded' });
    }

    // Return report data - frontend will handle PDF generation
    res.json({
      report,
      format: 'pdf'
    });
  } catch (error) {
    console.error('Download PDF error:', error);
    res.status(500).json({ error: 'Failed to download report' });
  }
});

// Download report as Word
router.get('/download/:id/word', async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Only allow download of finalized reports
    if (report.status !== 'FINAL') {
      return res.status(403).json({ error: 'Only finalized reports can be downloaded' });
    }

    // Return report data - frontend will handle Word generation
    res.json({
      report,
      format: 'word'
    });
  } catch (error) {
    console.error('Download Word error:', error);
    res.status(500).json({ error: 'Failed to download report' });
  }
});

module.exports = router;
