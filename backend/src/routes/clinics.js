const express = require('express');
const router = express.Router();
const Clinic = require('../models/Clinic');
const { adminOnly } = require('../middleware/auth');

// Get all clinics
router.get('/', async (req, res) => {
    try {
        let query = {};
        
        // If not ADMIN, only return clinics in their allowedClinics list
        if (req.user && req.user.role !== 'ADMIN') {
            // Ensure allowedClinics exists, otherwise empty array
            const allowed = req.user.allowedClinics || [];
            query = { _id: { $in: allowed } };
        }

        const clinics = await Clinic.find(query)
            .select('-orthancPassword')
            .sort({ isDefault: -1, name: 1 });
        res.json(clinics);
    } catch (error) {
        console.error('Get clinics error:', error);
        res.status(500).json({ error: 'Failed to fetch clinics' });
    }
});

// Get single clinic
router.get('/:id', async (req, res) => {
    try {
        const clinic = await Clinic.findById(req.params.id).select('-orthancPassword');
        if (!clinic) {
            return res.status(404).json({ error: 'Clinic not found' });
        }
        res.json(clinic);
    } catch (error) {
        console.error('Get clinic error:', error);
        res.status(500).json({ error: 'Failed to fetch clinic' });
    }
});

// Create clinic (admin only)
router.post('/', adminOnly, async (req, res) => {
    try {
        const clinic = new Clinic(req.body);
        await clinic.save();
        // Return clinic without password
        const clinicObj = clinic.toObject();
        delete clinicObj.orthancPassword;
        res.status(201).json(clinicObj);
    } catch (error) {
        console.error('Create clinic error:', error);
        res.status(500).json({ error: 'Failed to create clinic' });
    }
});

// Update clinic (admin only)
router.put('/:id', adminOnly, async (req, res) => {
    try {
        const clinic = await Clinic.findByIdAndUpdate(
            req.params.id,
            { ...req.body, updatedAt: Date.now() },
            { new: true, runValidators: true }
        ).select('-orthancPassword');

        if (!clinic) {
            return res.status(404).json({ error: 'Clinic not found' });
        }
        res.json(clinic);
    } catch (error) {
        console.error('Update clinic error:', error);
        res.status(500).json({ error: 'Failed to update clinic' });
    }
});

// Delete clinic (admin only)
router.delete('/:id', adminOnly, async (req, res) => {
    try {
        const clinic = await Clinic.findByIdAndDelete(req.params.id);
        if (!clinic) {
            return res.status(404).json({ error: 'Clinic not found' });
        }
        res.json({ message: 'Clinic deleted successfully' });
    } catch (error) {
        console.error('Delete clinic error:', error);
        res.status(500).json({ error: 'Failed to delete clinic' });
    }
});

module.exports = router;
