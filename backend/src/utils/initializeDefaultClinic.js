const Clinic = require('../models/Clinic');

async function initializeDefaultClinic() {
    try {
        // Check if any clinics exist
        const clinicCount = await Clinic.countDocuments();

        if (clinicCount === 0) {
            console.log('No clinics found. Creating default clinic from environment variables...');

            // Create default clinic from env vars
            // Note: The password will be encrypted by the pre-save hook in the Clinic model
            const defaultClinic = new Clinic({
                name: process.env.HOSPITAL_NAME || 'Default Clinic',
                address: process.env.HOSPITAL_ADDRESS || '',
                phone: process.env.HOSPITAL_PHONE || '',
                email: process.env.HOSPITAL_EMAIL || '',
                orthancUrl: process.env.ORTHANC_URL || '',
                orthancUsername: process.env.ORTHANC_USERNAME || '',
                orthancPassword: process.env.ORTHANC_PASSWORD || '', // Will be encrypted by pre-save hook
                isDefault: true
            });

            await defaultClinic.save();
            console.log('✅ Default clinic created successfully:', defaultClinic.name);
            console.log('   Orthanc URL:', defaultClinic.orthancUrl);
            console.log('   Orthanc Username:', defaultClinic.orthancUsername);
        } else {
            console.log(`Found ${clinicCount} existing clinic(s). Skipping default clinic creation.`);
        }
    } catch (error) {
        console.error('Error initializing default clinic:', error);
        // Don't throw - allow the app to continue even if this fails
    }
}

module.exports = initializeDefaultClinic;
