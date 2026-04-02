import { safeStorage } from 'electron'

// Prefix to identify encrypted data
const ENCRYPTION_PREFIX = 'ENC:'

/**
 * Check if encryption is available on this system
 */
export function isEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable()
}

/**
 * Mark data as encrypted by adding a prefix
 */
export function markAsEncrypted(data: string): string {
  return ENCRYPTION_PREFIX + data
}

/**
 * Check if data is encrypted (has our prefix)
 */
export function isEncrypted(data: string): boolean {
  return data.startsWith(ENCRYPTION_PREFIX)
}

/**
 * Encrypt sensitive data using safeStorage
 * Returns encrypted string with prefix, or original if encryption unavailable
 */
export function encryptSensitiveData(value: string): string {
  if (!value) return value

  if (!isEncryptionAvailable()) {
    console.warn('[Security] Encryption unavailable, storing as plaintext')
    return value
  }

  try {
    const encrypted = safeStorage.encryptString(value)
    return markAsEncrypted(encrypted.toString('base64'))
  } catch (error) {
    console.error('[Security] Encryption failed:', error)
    return value
  }
}

/**
 * Decrypt sensitive data using safeStorage
 * Returns decrypted string, or original if not encrypted/decryption fails
 */
export function decryptSensitiveData(encrypted: string): string {
  if (!encrypted) return encrypted

  // Not encrypted (plaintext or empty)
  if (!isEncrypted(encrypted)) {
    return encrypted
  }

  if (!isEncryptionAvailable()) {
    console.warn('[Security] Cannot decrypt - encryption unavailable')
    return encrypted
  }

  try {
    const base64Data = encrypted.slice(ENCRYPTION_PREFIX.length)
    const buffer = Buffer.from(base64Data, 'base64')
    return safeStorage.decryptString(buffer)
  } catch (error) {
    console.error('[Security] Decryption failed:', error)
    return ''
  }
}
