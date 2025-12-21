const crypto = require('crypto');
require('dotenv').config();

// Encryption configuration for sensitive data (Azure credentials)
const ENCRYPTION_CONFIG = {
  algorithm: 'aes-256-gcm',
  keyLength: 32, // 256 bits
  ivLength: 16,  // 128 bits
  tagLength: 16  // 128 bits
};

// Ensure encryption key exists
if (!process.env.ENCRYPTION_KEY) {
  console.error('ENCRYPTION_KEY environment variable is not set!');
  console.error('Generate one with: node -e "console.log(crypto.randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}

// Validate encryption key length
const encryptionKey = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
if (encryptionKey.length !== ENCRYPTION_CONFIG.keyLength) {
  console.error(`Invalid ENCRYPTION_KEY length. Expected ${ENCRYPTION_CONFIG.keyLength} bytes, got ${encryptionKey.length}`);
  process.exit(1);
}

module.exports = {
  ENCRYPTION_CONFIG,
  encryptionKey
};
