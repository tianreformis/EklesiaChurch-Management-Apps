import { hash, verify } from '@node-rs/argon2';

/**
 * Parameter argon2id yang wajar untuk server kecil (~19 MiB, 2 iterasi).
 * Password tidak pernah disimpan/di-log dalam bentuk asli.
 */
const OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password, OPTIONS);
  } catch {
    return false;
  }
}

/** Aturan password minimum; dipakai juga di UI lewat schema Zod bersama. */
export const PASSWORD_MIN_LENGTH = 8;
