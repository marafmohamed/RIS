const express = require('express');
const { body, validationResult } = require('express-validator');
const { authMiddleware } = require('../middleware/auth');
const Template = require('../models/Template');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Get all templates for current user
router.get('/', async (req, res) => {
  try {
    const { modality, studyType } = req.query;

    // Build filter to get user's own templates OR default templates from others
    const filter = {
      $or: [
        { userId: req.user._id },
        { isDefault: true }
      ]
    };

    if (modality) {
      filter.modality = modality;
    }

    if (studyType) {
      filter.studyType = studyType;
    }

    const templates = await Template.find(filter)
      .sort({ isDefault: -1, usageCount: -1, name: 1 });

    res.json(templates);
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Get single template
router.get('/:id', async (req, res) => {
  try {
    const template = await Template.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(template);
  } catch (error) {
    console.error('Get template error:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// Create new template
router.post('/', [
  body('name').notEmpty().trim(),
  body('technique').optional(),
  body('findings').optional(),
  body('conclusion').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      name,
      description,
      modality,
      studyType,
      technique,
      findings,
      conclusion,
      isDefault,
      triggerWord
    } = req.body;

    // If setting as default, unset other defaults for same modality
    if (isDefault && modality) {
      await Template.updateMany(
        { userId: req.user._id, modality, isDefault: true },
        { isDefault: false }
      );
    }

    const template = await Template.create({
      userId: req.user._id,
      name,
      description: description || '',
      modality: modality || '',
      studyType: studyType || '',
      technique: technique || '',
      findings: findings || '',
      conclusion: conclusion || '',
      isDefault: isDefault || false,
      triggerWord: triggerWord || ''
    });

    res.status(201).json({
      message: 'Template created successfully',
      template
    });
  } catch (error) {
    console.error('Create template error:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// Update template
router.put('/:id', async (req, res) => {
  try {

    const {
      name,
      description,
      modality,
      studyType,
      technique,
      findings,
      conclusion,
      isDefault,
      triggerWord
    } = req.body;

    const template = await Template.findOne({
      _id: req.params.id
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // If setting as default, unset other defaults for same modality
    if (isDefault && modality && !template.isDefault) {
      await Template.updateMany(
        { userId: req.user._id, modality, isDefault: true, _id: { $ne: template._id } },
        { isDefault: false }
      );
    }

    if (name !== undefined) template.name = name;
    if (description !== undefined) template.description = description;
    if (modality !== undefined) template.modality = modality;
    if (studyType !== undefined) template.studyType = studyType;
    if (technique !== undefined) template.technique = technique;
    if (findings !== undefined) template.findings = findings;
    if (conclusion !== undefined) template.conclusion = conclusion;
    if (isDefault !== undefined) template.isDefault = isDefault;
    if (triggerWord !== undefined) template.triggerWord = triggerWord;

    await template.save();

    res.json({
      message: 'Template updated successfully',
      template
    });
  } catch (error) {
    console.error('Update template error:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// Delete template
router.delete('/:id', async (req, res) => {
  try {
    const template = await Template.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Delete template error:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// Increment usage count
router.post('/:id/use', async (req, res) => {
  try {
    // Allow incrementing usage for own templates or default templates
    const template = await Template.findOne({
      _id: req.params.id,
      $or: [
        { userId: req.user._id },
        { isDefault: true }
      ]
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    template.usageCount += 1;
    await template.save();

    res.json({ message: 'Usage count updated', template });
  } catch (error) {
    console.error('Update usage count error:', error);
    res.status(500).json({ error: 'Failed to update usage count' });
  }
});

module.exports = router;
