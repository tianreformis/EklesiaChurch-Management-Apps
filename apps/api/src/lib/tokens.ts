import { createHash, randomBytes } from 'node:crypto';

/** Token acak 32 byte, dikodekan base64url (aman untuk URL dan cookie). */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Token sesi/undangan disimpan di database hanya dalam bentuk hash SHA-256. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createSessionToken(): { token: string; tokenHash: string } {
  const token = generateToken();
  return { token, tokenHash: hashToken(token) };
}

export function createAuthToken(): { token: string; tokenHash: string } {
  const token = generateToken();
  return { token, tokenHash: hashToken(token) };
}
