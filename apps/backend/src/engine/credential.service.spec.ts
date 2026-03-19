import { CredentialService } from './credential.service';

describe('CredentialService', () => {
  const TEST_KEY_BASE64 = Buffer.alloc(32, 'a').toString('base64');

  const createService = (keyOverride?: string | null) => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'CREDENTIAL_ENCRYPTION_KEY') {
          return keyOverride === undefined ? TEST_KEY_BASE64 : keyOverride;
        }
        return undefined;
      }),
    };
    return new CredentialService(configService as any);
  };

  describe('constructor', () => {
    it('should throw if CREDENTIAL_ENCRYPTION_KEY is missing', () => {
      expect(() => createService(null)).toThrow(
        'CREDENTIAL_ENCRYPTION_KEY environment variable is required',
      );
    });

    it('should throw if CREDENTIAL_ENCRYPTION_KEY is empty string', () => {
      expect(() => createService('')).toThrow(
        'CREDENTIAL_ENCRYPTION_KEY environment variable is required',
      );
    });

    it('should throw if key is not 32 bytes', () => {
      const shortKey = Buffer.alloc(16, 'a').toString('base64');
      expect(() => createService(shortKey)).toThrow(
        'CREDENTIAL_ENCRYPTION_KEY must be 32 bytes',
      );
    });

    it('should create service with valid 32-byte key', () => {
      expect(() => createService()).not.toThrow();
    });
  });

  describe('encrypt', () => {
    it('should return string in base64:base64:base64 format (3 colon-separated parts)', () => {
      const service = createService();
      const encrypted = service.encrypt('hello');

      const parts = encrypted.split(':');
      expect(parts).toHaveLength(3);
      parts.forEach((p) => {
        expect(p.length).toBeGreaterThan(0);
        // Verify each part is valid base64
        const decoded = Buffer.from(p, 'base64');
        expect(decoded.length).toBeGreaterThan(0);
      });
    });

    it('should produce different ciphertext for same plaintext (random IV)', () => {
      const service = createService();
      const enc1 = service.encrypt('hello');
      const enc2 = service.encrypt('hello');
      expect(enc1).not.toBe(enc2);
    });
  });

  describe('decrypt', () => {
    it('should roundtrip: decrypt(encrypt(text)) === text', () => {
      const service = createService();
      const plaintext = 'hello world 🌍';
      const encrypted = service.encrypt(plaintext);
      expect(service.decrypt(encrypted)).toBe(plaintext);
    });

    it('should roundtrip with empty string', () => {
      const service = createService();
      const encrypted = service.encrypt('');
      expect(service.decrypt(encrypted)).toBe('');
    });

    it('should roundtrip with long text', () => {
      const service = createService();
      const longText = 'a'.repeat(10000);
      const encrypted = service.encrypt(longText);
      expect(service.decrypt(encrypted)).toBe(longText);
    });

    it('should throw on garbage input', () => {
      const service = createService();
      expect(() => service.decrypt('garbage')).toThrow();
    });

    it('should throw on tampered ciphertext', () => {
      const service = createService();
      const encrypted = service.encrypt('hello');
      const parts = encrypted.split(':');
      parts[2] = Buffer.from('tampered').toString('base64');
      expect(() => service.decrypt(parts.join(':'))).toThrow();
    });

    it('should throw when decrypted with wrong key', () => {
      const service1 = createService();
      const encrypted = service1.encrypt('hello');

      const differentKey = Buffer.alloc(32, 'b').toString('base64');
      const service2 = createService(differentKey);
      expect(() => service2.decrypt(encrypted)).toThrow();
    });
  });

  describe('isEncrypted', () => {
    it('should return true for encrypted values', () => {
      const service = createService();
      const encrypted = service.encrypt('hello');
      expect(service.isEncrypted(encrypted)).toBe(true);
    });

    it('should return false for plaintext', () => {
      const service = createService();
      expect(service.isEncrypted('plaintext')).toBe(false);
    });

    it('should return false for two-part string', () => {
      const service = createService();
      expect(service.isEncrypted('part1:part2')).toBe(false);
    });

    it('should return false for empty string', () => {
      const service = createService();
      expect(service.isEncrypted('')).toBe(false);
    });
  });
});
