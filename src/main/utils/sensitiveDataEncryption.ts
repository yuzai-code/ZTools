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

/**
 * Data migration types
 */
export interface AIModelsData {
  apiKey: string
}

export interface ServerConfigData {
  apiKey: string
}

/**
 * Migrate sensitive data from plaintext to encrypted format.
 * Detects plaintext data (no ENC: prefix), encrypts it, and updates the database.
 *
 * @param getData - Function to get current data from database
 * @param saveData - Function to save updated data to database
 * @param dataType - Type of data being migrated (for logging)
 * @returns true if migration was performed, false otherwise
 */
export async function migrateData<T>(
  getData: () => T | null,
  saveData: (data: T) => void,
  dataType: string
): Promise<boolean> {
  if (!isEncryptionAvailable()) {
    console.warn(`[Security] ${dataType}: Encryption unavailable, skipping migration`)
    return false
  }

  const data = getData()
  if (!data) {
    return false
  }

  let migrated = false

  // Handle AI models array
  if (Array.isArray(data)) {
    for (const item of data as Record<string, unknown>[]) {
      if (item.apiKey && typeof item.apiKey === 'string' && !isEncrypted(item.apiKey)) {
        console.log(
          `[Security] ${dataType}: Migrating plaintext apiKey for "${item.id || item.label || 'unknown'}"`
        )
        item.apiKey = encryptSensitiveData(item.apiKey)
        migrated = true
      }
    }
  }
  // Handle object with apiKey (HTTP Server, MCP Server)
  else if (typeof data === 'object' && data !== null && 'apiKey' in data) {
    const config = data as Record<string, unknown>
    if (config.apiKey && typeof config.apiKey === 'string' && !isEncrypted(config.apiKey)) {
      console.log(`[Security] ${dataType}: Migrating plaintext apiKey`)
      config.apiKey = encryptSensitiveData(config.apiKey)
      migrated = true
    }
  }

  if (migrated) {
    saveData(data)
    console.log(`[Security] ${dataType}: Migration completed`)
  }

  return migrated
}
