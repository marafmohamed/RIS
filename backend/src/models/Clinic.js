const mongoose = require('mongoose');
const { encrypt, decrypt } = require('../utils/encryption');

const clinicSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    nameArabic: {
        type: String,
        trim: true,
        default: ''
    },
    headerContent: {
        type: String, // Rich HTML content
        default: ''
    },
    footerContent: {
        type: String, // Rich HTML content
        default: ''
    },
    address: {
        type: String,
        default: ''
    },
    phone: {
        type: String,
        default: ''
    },
    email: {
        type: String,
        default: ''
    },
    orthancUrl: {
        type: String,
        default: ''
    },
    orthancUsername: {
        type: String,
        default: ''
    },
    orthancPassword: {
        type: String,
        default: '' // Stored encrypted
    },
    isDefault: {
        type: Boolean,
        default: false
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

// Encrypt password before saving
clinicSchema.pre('save', async function (next) {
    if (this.isModified('orthancPassword') && this.orthancPassword) {
        // Only encrypt if it's not already encrypted (check for the ':' separator used in encryption)
        if (!this.orthancPassword.includes(':')) {
            console.log('Encrypting password for clinic:', this.name);
            this.orthancPassword = encrypt(this.orthancPassword);
            if (!this.orthancPassword) {
                return next(new Error('Password encryption failed'));
            }
        } else {
            console.log('Password already encrypted for clinic:', this.name);
        }
    }
    next();
});

// Ensure only one default clinic exists
clinicSchema.pre('save', async function (next) {
    if (this.isDefault) {
        await this.constructor.updateMany(
            { _id: { $ne: this._id } },
            { $set: { isDefault: false } }
        );
    }
    next();
});

module.exports = mongoose.model('Clinic', clinicSchema);
