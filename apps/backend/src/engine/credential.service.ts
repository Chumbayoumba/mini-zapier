import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

@Injectable()
export class CredentialService {
  private readonly key: Buffer;

  constructor(private readonly configService: ConfigService) {
    const keyBase64 = this.configService.get<string>('CREDENTIAL_ENCRYPTION_KEY');
    if (!keyBase64) {
      throw new Error('CREDENTIAL_ENCRYPTION_KEY environment variable is required');
    }
    this.key = Buffer.from(keyBase64, 'base64');
    if (this.key.length !== 32) {
      throw new Error(
        `CREDENTIAL_ENCRYPTION_KEY must be 32 bytes (got ${this.key.length}). Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
      );
    }
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  decrypt(encryptedValue: string): string {
    const parts = encryptedValue.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted value format');
    }
    const [ivB64, authTagB64, dataB64] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const encrypted = Buffer.from(dataB64, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted).toString('utf8') + decipher.final('utf8');
  }

  isEncrypted(value: string): boolean {
    const parts = value.split(':');
    if (parts.length !== 3) return false;
    return parts.every((p) => /^[A-Za-z0-9+/=]+$/.test(p) && p.length > 0);
  }
}
