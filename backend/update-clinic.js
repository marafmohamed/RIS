const Clinic = require('./src/models/Clinic');
const { encrypt } = require('./src/utils/encryption');

async function updateClinic() {
    try {
        const clinic = await Clinic.findOne({ name: 'Default Clinic' });

        if (!clinic) {
            console.log('No clinic found. Creating new one...');
            const newClinic = new Clinic({
                name: process.env.HOSPITAL_NAME || 'Default Clinic',
                address: process.env.HOSPITAL_ADDRESS || '',
                phone: process.env.HOSPITAL_PHONE || '',
                email: process.env.HOSPITAL_EMAIL || '',
                orthancUrl: process.env.ORTHANC_URL || '',
                orthancUsername: process.env.ORTHANC_USERNAME || '',
                orthancPassword: process.env.ORTHANC_PASSWORD || '',
                isDefault: true
            });
            await newClinic.save();
            console.log('✅ Created new clinic with encrypted password');
        } else {
            console.log('Found clinic:', clinic.name);
            console.log('Current password:', clinic.orthancPassword);

            // Manually encrypt the password
            clinic.orthancPassword = process.env.ORTHANC_PASSWORD;
            await clinic.save();

            console.log('✅ Updated clinic password');
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('Connected to MongoDB');
        updateClinic();
    })
    .catch(err => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    });
