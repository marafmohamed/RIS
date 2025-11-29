const Clinic = require('./src/models/Clinic');

async function fixClinic() {
    try {
        // Delete all clinics
        const result = await Clinic.deleteMany({});
        console.log(`Deleted ${result.deletedCount} clinic(s)`);
        console.log('Please restart your backend server to recreate the default clinic with proper encryption.');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

// Connect to DB and fix
const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('Connected to MongoDB');
        fixClinic();
    })
    .catch(err => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    });
