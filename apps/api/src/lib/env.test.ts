import { describe, expect, it } from 'vitest';
import { EnvValidationError, parseEnv } from './env.js';

const validEnv = {
  DATABASE_URL: 'postgres://eklesia:secret@127.0.0.1:5432/eklesia',
} satisfies NodeJS.ProcessEnv;

describe('parseEnv', () => {
  it('mengisi nilai bawaan yang aman', () => {
    const env = parseEnv(validEnv);

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.APP_NAME).toBe('Eklesia');
  });

  it('mengubah PORT menjadi angka', () => {
    const env = parseEnv({ ...validEnv, PORT: '8080' });
    expect(env.PORT).toBe(8080);
  });

  it('menolak PORT yang bukan angka', () => {
    expect(() => parseEnv({ ...validEnv, PORT: 'abc' })).toThrow(EnvValidationError);
  });

  it('menolak DATABASE_URL yang hilang', () => {
    expect(() => parseEnv({})).toThrow(EnvValidationError);
  });

  it('menolak DATABASE_URL bukan PostgreSQL', () => {
    expect(() => parseEnv({ DATABASE_URL: 'mysql://localhost/db' })).toThrow(EnvValidationError);
  });

  it('tidak mencetak nilai rahasia pada pesan error', () => {
    try {
      parseEnv({ DATABASE_URL: 'bukan-url', LOG_LEVEL: 'verbose' });
      expect.unreachable('seharusnya melempar error');
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      expect((error as EnvValidationError).message).not.toContain('bukan-url');
      expect((error as EnvValidationError).issues.length).toBe(2);
    }
  });
});
