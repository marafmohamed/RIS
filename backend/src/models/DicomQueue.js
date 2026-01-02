const mongoose = require('mongoose');

const DicomQueueSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    studyInstanceUid: {
        type: String,
        required: true
    },
    patientName: String,
    patientId: String,
    studyDate: Date,
    modality: String,
    description: String,
    targetNode: {
        type: String,
        required: true
    },
    clinicId: {
        type: String, // Stored as string to pass to OrthancService
        required: true
    },
    status: {
        type: String,
        enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
        default: 'PENDING'
    },
    jobId: String, // ID of the job in Orthanc
    progress: {
        type: Number,
        default: 0
    },
    error: String,
    retryCount: {
        type: Number,
        default: 0
    },
}, {
    timestamps: true
});

// Index for efficient querying by user and status
DicomQueueSchema.index({ userId: 1, status: 1 });
DicomQueueSchema.index({ createdAt: 1 });

module.exports = mongoose.model('DicomQueue', DicomQueueSchema);
