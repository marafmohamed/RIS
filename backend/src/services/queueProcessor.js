const DicomQueue = require('../models/DicomQueue');
const Clinic = require('../models/Clinic');
const OrthancService = require('./orthancService');

// Helper to get service for a specific clinic (similar to studies route)
async function getOrthancService(clinicId) {
    if (clinicId) {
        const clinic = await Clinic.findById(clinicId);
        if (clinic) {
            return OrthancService.fromClinic(clinic);
        }
    }
    return new OrthancService();
}

class QueueProcessor {
    constructor() {
        this.isRunning = false;
        this.intervalId = null;
        this.INTERVAL_MS = 2000; // Check every 2 seconds
    }

    start() {
        if (this.isRunning) return;
        console.log('Starting DICOM Queue Processor...');
        this.isRunning = true;
        this.intervalId = setInterval(() => this.processCycle(), this.INTERVAL_MS);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        console.log('DICOM Queue Processor stopped.');
    }

    async processCycle() {
        try {
            await this.checkProcessingJobs();
            await this.dispatchPendingJobs();
        } catch (error) {
            console.error('Queue Processor Cycle Error:', error);
        }
    }

    // 1. Check status of currently running jobs
    async checkProcessingJobs() {
        const processingJobs = await DicomQueue.find({ status: 'PROCESSING' });

        for (const job of processingJobs) {
            try {
                if (!job.jobId) {
                    // Should not happen, but if no JobID, mark failed or assume done?
                    // If older Orthanc without jobs, we might have assumed success immediately.
                    // But here we set PROCESSING only if we got a generic ack?
                    // For now, fail it if no JobID.
                    job.status = 'FAILED';
                    job.error = 'Missing Orthanc Job ID';
                    await job.save();
                    continue;
                }

                const orthancService = await getOrthancService(job.clinicId);

                let jobStatus;
                try {
                    jobStatus = await orthancService.getJobStatus(job.jobId);
                } catch (err) {
                    // If 404, the job might be expired/deleted. Check logic.
                    // Orthanc keeps jobs for a while.
                    if (err.message && err.message.includes('404')) {
                        // Assume success if 404? Or Fail?
                        // Usually Orthanc keeps it. If gone, it might be very old or server restarted.
                        // We'll mark as FAILED for safety, unless we want to assume success.
                        console.warn(`Job ${job.jobId} not found in Orthanc. Marking FAILED.`);
                        job.status = 'FAILED';
                        job.error = 'Job not found in Orthanc (404)';
                        await job.save();
                        continue;
                    }
                    throw err;
                }

                if (jobStatus.State === 'Success') {
                    job.status = 'COMPLETED';
                    job.progress = 100;
                    await job.save();
                } else if (jobStatus.State === 'Failure') {
                    job.status = 'FAILED';
                    job.error = jobStatus.ErrorDetails || 'Orthanc Job Failed';
                    await job.save();
                } else if (jobStatus.State === 'Running' || jobStatus.State === 'Pending') {
                    // Update progress
                    if (jobStatus.Progress !== undefined) {
                        job.progress = Math.round(jobStatus.Progress);
                        await job.save();
                    }
                }
            } catch (err) {
                console.error(`Error checking job ${job._id}:`, err.message);
                // Don't fail immediately on transient network errors, just skip this cycle
            }
        }
    }

    // 2. Dispatch pending jobs (Sequential per user)
    async dispatchPendingJobs() {
        // Find users who have PENDING items
        const usersWithPending = await DicomQueue.distinct('userId', { status: 'PENDING' });

        for (const userId of usersWithPending) {
            // Check if this user already has a PROCESSING job
            const isProcessing = await DicomQueue.exists({ userId, status: 'PROCESSING' });

            if (!isProcessing) {
                // Pick the oldest PENDING job for this user
                const nextJob = await DicomQueue.findOne({ userId, status: 'PENDING' }).sort({ createdAt: 1 });

                if (nextJob) {
                    await this.processJob(nextJob);
                }
            }
        }
    }

    async processJob(job) {
        console.log(`Dispatching Job ${job._id} for study ${job.studyInstanceUid} to ${job.targetNode}`);
        try {
            job.status = 'PROCESSING';
            job.startedAt = new Date();
            await job.save();

            const orthancService = await getOrthancService(job.clinicId);

            // Find Orthanc internal ID
            const search = await orthancService.findStudies({ StudyInstanceUID: job.studyInstanceUid });

            if (!search || search.length === 0) {
                job.status = 'FAILED';
                job.error = 'Study not found in PACS';
                await job.save();
                return;
            }

            const orthancId = search[0].ID;

            // Send
            const result = await orthancService.sendStudyToModality(orthancId, job.targetNode);

            if (result.ID) { // Job ID returned
                job.jobId = result.ID;
                job.progress = 0;
                await job.save();
            } else {
                // Immediate completion (older Orthanc or sync config)
                job.status = 'COMPLETED';
                job.progress = 100;
                await job.save();
            }

        } catch (error) {
            console.error(`Failed to dispatch job ${job._id}:`, error);
            job.status = 'FAILED';
            job.error = error.message || 'Dispatch Failed';
            await job.save();
        }
    }
}

// Singleton
const queueProcessor = new QueueProcessor();
module.exports = queueProcessor;
