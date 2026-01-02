const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const DicomQueue = require('../models/DicomQueue');

const router = express.Router();

// Require auth
router.use(authMiddleware);

// Get Queue for User
router.get('/', async (req, res) => {
    try {
        const queue = await DicomQueue.find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .limit(50); // Limit to last 50 items
        res.json(queue);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch queue' });
    }
});

// Add items to queue
router.post('/', async (req, res) => {
    try {
        const { studies, targetNode, clinicId } = req.body;

        if (!studies || !Array.isArray(studies) || studies.length === 0) {
            return res.status(400).json({ error: 'No studies provided' });
        }
        if (!targetNode) {
            return res.status(400).json({ error: 'Target node required' });
        }

        const items = [];
        for (const study of studies) {
            // Check if already in queue (PENDING or PROCESSING)
            const existing = await DicomQueue.findOne({
                userId: req.user._id,
                studyInstanceUid: study.studyInstanceUid,
                status: { $in: ['PENDING', 'PROCESSING'] }
            });

            if (!existing) {
                items.push({
                    userId: req.user._id,
                    studyInstanceUid: study.studyInstanceUid,
                    patientName: study.patientName,
                    patientId: study.patientId,
                    studyDate: study.studyDate,
                    modality: study.modality,
                    description: study.studyDescription,
                    targetNode,
                    clinicId,
                    status: 'PENDING'
                });
            }
        }

        if (items.length > 0) {
            await DicomQueue.insertMany(items);
        }

        res.json({ message: `${items.length} items added to queue` });
    } catch (error) {
        console.error('Add to queue error:', error);
        res.status(500).json({ error: 'Failed to add to queue' });
    }
});

// Retry a job
router.post('/:id/retry', async (req, res) => {
    try {
        const job = await DicomQueue.findOne({ _id: req.params.id, userId: req.user._id });
        if (!job) return res.status(404).json({ error: 'Job not found' });

        job.status = 'PENDING';
        job.error = null;
        job.progress = 0;
        job.jobId = null;
        job.retryCount += 1;
        await job.save();

        res.json(job);
    } catch (error) {
        res.status(500).json({ error: 'Failed to retry job' });
    }
});

// Delete a job
router.delete('/:id', async (req, res) => {
    try {
        await DicomQueue.deleteOne({ _id: req.params.id, userId: req.user._id });
        res.json({ message: 'Removed' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to remove job' });
    }
});

// Clear completed/failed
router.delete('/', async (req, res) => {
    try {
        await DicomQueue.deleteMany({
            userId: req.user._id,
            status: { $in: ['COMPLETED', 'FAILED'] }
        });
        res.json({ message: 'Cleared history' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to clear history' });
    }
});

module.exports = router;
