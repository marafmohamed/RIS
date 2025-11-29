const crypto = require('crypto');

// Ensure the key is exactly 32 bytes for AES-256
function getEncryptionKey() {
    const key = process.env.CLINIC_ENCRYPTION_KEY || 'default_secret_key_must_be_32_bytes_long!!';

    // If key is exactly 32 bytes, use it
    if (key.length === 32) {
        return key;
    }

    // Otherwise, hash it to get exactly 32 bytes
    return crypto.createHash('sha256').update(key).digest('hex').substring(0, 32);
}

const ENCRYPTION_KEY = getEncryptionKey();
const IV_LENGTH = 16; // For AES, this is always 16

function encrypt(text) {
    if (!text) return text;
    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return iv.toString('hex') + ':' + encrypted.toString('hex');
    } catch (error) {
        console.error('Encryption error:', error);
        return null;
    }
}

function decrypt(text) {
    if (!text) return text;
    try {
        const textParts = text.split(':');
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (error) {
        console.error('Decryption error:', error);
        return null;
    }
}

module.exports = { encrypt, decrypt };
