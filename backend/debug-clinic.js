const Clinic = require('./src/models/Clinic');
const { decrypt } = require('./src/utils/encryption');

async function checkClinic() {
    try {
        const clinic = await Clinic.findOne({ isDefault: true });
        if (clinic) {
            console.log('\n=== Clinic Debug Info ===');
            console.log('Name:', clinic.name);
            console.log('Orthanc URL:', clinic.orthancUrl);
            console.log('Orthanc Username:', clinic.orthancUsername);
            console.log('Encrypted Password:', clinic.orthancPassword);
            console.log('Encrypted Password Length:', clinic.orthancPassword ? clinic.orthancPassword.length : 0);

            if (clinic.orthancPassword) {
                try {
                    const decrypted = decrypt(clinic.orthancPassword);
                    console.log('Decrypted Password:', decrypted);
                    console.log('Decrypted Length:', decrypted ? decrypted.length : 0);
                } catch (err) {
                    console.log('Decryption Error:', err.message);
                }
            }
            console.log('========================\n');
        } else {
            console.log('No default clinic found');
        }
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

// Connect to DB and check
const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('Connected to MongoDB');
        checkClinic();
    })
    .catch(err => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    });
