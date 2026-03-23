import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const SALT_LENGTH = 16;
const KEY_LENGTH = 64;

export function hashPassword(plainPassword: string): string {
  const salt = randomBytes(SALT_LENGTH).toString('hex');
  const derivedKey = scryptSync(plainPassword, salt, KEY_LENGTH).toString('hex');
  return `scrypt$${salt}$${derivedKey}`;
}

export function isPasswordHashed(value: string): boolean {
  return typeof value === 'string' && value.startsWith('scrypt$');
}

export function verifyPassword(plainPassword: string, storedHash: string): boolean {
  const [algorithm, salt, hashed] = storedHash.split('$');
  if (algorithm !== 'scrypt' || !salt || !hashed) {
    return false;
  }

  const computed = scryptSync(plainPassword, salt, KEY_LENGTH);
  const stored = Buffer.from(hashed, 'hex');

  if (computed.length !== stored.length) {
    return false;
  }

  return timingSafeEqual(computed, stored);
}
