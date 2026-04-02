import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  encryptSensitiveData,
  decryptSensitiveData,
  isEncryptionAvailable,
  markAsEncrypted,
  isEncrypted
} from '../../src/main/utils/sensitiveDataEncryption'

// Mock electron safeStorage
vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((value: string) => Buffer.from(`encrypted:${value}`)),
    decryptString: vi.fn((buffer: Buffer) => {
      const str = buffer.toString()
      return str.replace('encrypted:', '')
    })
  }
}))

describe('sensitiveDataEncryption', () => {
  describe('isEncryptionAvailable', () => {
    it('should return true when safeStorage is available', () => {
      expect(isEncryptionAvailable()).toBe(true)
    })
  })

  describe('encryptSensitiveData', () => {
    it('should encrypt a string value', () => {
      const result = encryptSensitiveData('my-secret-key')
      // Encrypted data should be marked with ENC: prefix
      expect(isEncrypted(result)).toBe(true)
      // And it should be base64 encoded
      expect(result.startsWith('ENC:')).toBe(true)
    })

    it('should return empty string for empty input', () => {
      expect(encryptSensitiveData('')).toBe('')
    })

    it('should mark encrypted data', () => {
      const result = encryptSensitiveData('test')
      expect(isEncrypted(result)).toBe(true)
    })
  })

  describe('decryptSensitiveData', () => {
    it('should decrypt an encrypted value', () => {
      const encrypted = encryptSensitiveData('my-secret-key')
      const decrypted = decryptSensitiveData(encrypted)
      expect(decrypted).toBe('my-secret-key')
    })

    it('should return empty string for empty input', () => {
      expect(decryptSensitiveData('')).toBe('')
    })

    it('should handle plaintext input gracefully', () => {
      // Plaintext should be returned as-is (not encrypted format)
      expect(decryptSensitiveData('plaintext')).toBe('plaintext')
    })
  })

  describe('isEncrypted', () => {
    it('should return true for encrypted data', () => {
      const encrypted = encryptSensitiveData('test')
      expect(isEncrypted(encrypted)).toBe(true)
    })

    it('should return false for plaintext', () => {
      expect(isEncrypted('plaintext')).toBe(false)
    })
  })
})
