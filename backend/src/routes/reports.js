const express = require('express');
const { body, validationResult } = require('express-validator');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const Report = require('../models/Report');

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

module.exports = router;
