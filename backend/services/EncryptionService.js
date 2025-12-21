const crypto = require('crypto');
const { ENCRYPTION_CONFIG, encryptionKey } = require('../config/encryption');

/**
 * Encryption service for sensitive data (Azure client secrets)
 * Uses AES-256-GCM for authenticated encryption
 */
class EncryptionService {
  /**
   * Encrypt plaintext using AES-256-GCM
   * @param {string} plaintext - The text to encrypt
   * @returns {string} - Encrypted data in format: iv:authTag:encryptedData (all hex)
   */
  encrypt(plaintext) {
    if (!plaintext) {
      throw new Error('Cannot encrypt empty string');
    }

    // Generate random IV
    const iv = crypto.randomBytes(ENCRYPTION_CONFIG.ivLength);

    // Create cipher
    const cipher = crypto.createCipheriv(
      ENCRYPTION_CONFIG.algorithm,
      encryptionKey,
      iv
    );

    // Encrypt data
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Return IV:AuthTag:EncryptedData
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt data encrypted with encrypt()
   * @param {string} encryptedData - Encrypted data in format: iv:authTag:encryptedData
   * @returns {string} - Decrypted plaintext
   */
  decrypt(encryptedData) {
    if (!encryptedData) {
      throw new Error('Cannot decrypt empty string');
    }

    try {
      // Split into components
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }

      const [ivHex, authTagHex, encrypted] = parts;

      // Convert from hex
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      // Create decipher
      const decipher = crypto.createDecipheriv(
        ENCRYPTION_CONFIG.algorithm,
        encryptionKey,
        iv
      );

      // Set authentication tag
      decipher.setAuthTag(authTag);

      // Decrypt data
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error.message);
      throw new Error('Failed to decrypt data. The encryption key may be incorrect.');
    }
  }

  /**
   * Generate a new encryption key (for initial setup)
   * @returns {string} - 32-byte key as hex string
   */
  static generateKey() {
    return crypto.randomBytes(ENCRYPTION_CONFIG.keyLength).toString('hex');
  }
}

module.exports = new EncryptionService();
