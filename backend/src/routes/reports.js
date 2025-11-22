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
    if (req.user.role !== 'ADMIN') {
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
    const { content, status } = req.body;

    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Only the author can edit draft reports
    if (report.status === 'DRAFT' && report.authorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You can only edit your own draft reports' });
    }

    // Final reports can only be edited by admins
    if (report.status === 'FINAL' && req.user.role !== 'ADMIN') {
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

module.exports = router;
