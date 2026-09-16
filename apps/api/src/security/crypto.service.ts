import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt } from 'node:crypto';

@Injectable()
export class CryptoService {
  private readonly encryptionKey: Buffer;
  private readonly bcryptCost: number;
  constructor(config: ConfigService) {
    this.encryptionKey = Buffer.from(config.getOrThrow<string>('APP_ENCRYPTION_KEY'), 'base64');
    this.bcryptCost = config.getOrThrow<number>('BCRYPT_COST');
  }
  randomToken(bytes = 32): string { return randomBytes(bytes).toString('base64url'); }
  hashOpaque(value: string): string { return createHash('sha256').update(value).digest('base64url'); }
  async hashRecoveryCode(value: string): Promise<string> { return bcrypt.hash(this.normalizeRecoveryCode(value), this.bcryptCost); }
  async verifyRecoveryCode(value: string, hash: string): Promise<boolean> { return bcrypt.compare(this.normalizeRecoveryCode(value), hash); }
  encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return ['v1', iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.');
  }
  decrypt(payload: string): string {
    const [version, ivRaw, tagRaw, ciphertextRaw] = payload.split('.');
    if (version !== 'v1' || !ivRaw || !tagRaw || !ciphertextRaw) throw new Error('Encrypted payload invalido');
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, Buffer.from(ivRaw, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(ciphertextRaw, 'base64url')), decipher.final()]).toString('utf8');
  }
  generateRecoveryCodes(count = 10): string[] {
    return Array.from({ length: count }, () => {
      const part = () => this.randomHumanChunk(4);
      return `IREC-${part()}-${part()}-${part()}`;
    });
  }
  private randomHumanChunk(length: number): string {
    const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    return Array.from({ length }, () => alphabet[randomInt(0, alphabet.length)]).join('');
  }
  private normalizeRecoveryCode(value: string): string { return value.trim().toUpperCase().replace(/\s+/g, ''); }
}
