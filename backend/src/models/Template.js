const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  modality: {
    type: String,
    trim: true,
    index: true
  },
  studyType: {
    type: String,
    trim: true
  },
  // Three-section template structure
  technique: {
    type: String,
    default: ''
  },
  findings: {
    type: String,
    default: ''
  },
  conclusion: {
    type: String,
    default: ''
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  usageCount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on save
templateSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for quick lookups
templateSchema.index({ userId: 1, modality: 1 });
templateSchema.index({ userId: 1, isDefault: 1 });

module.exports = mongoose.model('Template', templateSchema);
