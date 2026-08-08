/**
 * [INPUT]: ANYHUNT_DATA_SECRET_KEY and server-owned plaintext/token subjects
 * [OUTPUT]: Purpose-bound AES-GCM ciphertext and signed opaque tokens
 * [POS]: Shared boundary for non-LLM secrets; never logs plaintext or ciphertext
 */

import { Injectable } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

const ENV_NAME = 'ANYHUNT_DATA_SECRET_KEY';
const VERSION = 'v1';
const KEY_BYTES = 32;
const IV_BYTES = 12;

function keyFromEnvironment(): Buffer {
  const raw = process.env[ENV_NAME]?.trim();
  if (!raw) throw new Error(`${ENV_NAME} must be set`);
  const key = Buffer.from(raw, 'base64');
  if (key.length !== KEY_BYTES) {
    throw new Error(`${ENV_NAME} must be base64(32 bytes)`);
  }
  return key;
}

@Injectable()
export class DataSecretService {
  encrypt(purpose: string, plaintext: string): string {
    const key = keyFromEnvironment();
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(purpose));
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    return [
      VERSION,
      iv.toString('base64url'),
      ciphertext.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
    ].join('.');
  }

  decrypt(purpose: string, encrypted: string): string {
    const [version, ivPart, ciphertextPart, tagPart, extra] =
      encrypted.split('.');
    if (
      version !== VERSION ||
      !ivPart ||
      !ciphertextPart ||
      !tagPart ||
      extra
    ) {
      throw new Error('Invalid encrypted data payload');
    }
    const decipher = createDecipheriv(
      'aes-256-gcm',
      keyFromEnvironment(),
      Buffer.from(ivPart, 'base64url'),
    );
    decipher.setAAD(Buffer.from(purpose));
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextPart, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  signToken(purpose: string, subject: string): string {
    if (!subject || subject.length > 256)
      throw new Error('Invalid token subject');
    const encoded = Buffer.from(subject).toString('base64url');
    return `${encoded}.${this.signature(purpose, encoded)}`;
  }

  verifyToken(purpose: string, token: string): string | null {
    const [encoded, provided, extra] = token.split('.');
    if (!encoded || !provided || extra || token.length > 512) return null;
    const expected = this.signature(purpose, encoded);
    const expectedBuffer = Buffer.from(expected);
    const providedBuffer = Buffer.from(provided);
    if (
      expectedBuffer.length !== providedBuffer.length ||
      !timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
      return null;
    }
    const subject = Buffer.from(encoded, 'base64url').toString('utf8');
    return subject && subject.length <= 256 ? subject : null;
  }

  private signature(purpose: string, encodedSubject: string): string {
    return createHmac('sha256', keyFromEnvironment())
      .update(purpose)
      .update('\0')
      .update(encodedSubject)
      .digest('base64url');
  }
}
