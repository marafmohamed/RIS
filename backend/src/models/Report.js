const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  studyInstanceUid: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  patientName: {
    type: String,
    required: true
  },
  patientId: {
    type: String,
    required: true
  },
  studyDate: {
    type: Date,
    required: true
  },
  modality: {
    type: String,
    default: ''
  },
  studyDescription: {
    type: String,
    default: ''
  },
  content: {
    type: String,
    default: ''
  },
  conclusion: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['DRAFT', 'FINAL'],
    default: 'DRAFT'
  },
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  authorName: {
    type: String,
    required: true
  },
  finalizedAt: {
    type: Date
  },
  // Validation tracking for referring physicians
  validatedBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    userName: String,
    validatedAt: {
      type: Date,
      default: Date.now
    },
    feedback: String
  }],
  // Quality ratings from referring physicians
  ratings: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    userName: String,
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String,
    ratedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Computed metrics
  averageRating: {
    type: Number,
    default: 0
  },
  validationCount: {
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
reportSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  if (this.status === 'FINAL' && !this.finalizedAt) {
    this.finalizedAt = Date.now();
  }
  next();
});

// Index for efficient queries
reportSchema.index({ studyDate: -1 });
reportSchema.index({ status: 1 });
reportSchema.index({ authorId: 1 });

module.exports = mongoose.model('Report', reportSchema);
