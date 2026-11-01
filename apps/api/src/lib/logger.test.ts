import { describe, expect, it } from 'vitest';
import { createLogger } from './logger.js';

function captureLines(): { lines: string[]; destination: { write(chunk: string): void } } {
  const lines: string[] = [];
  return {
    lines,
    destination: {
      write(chunk: string) {
        lines.push(chunk);
      },
    },
  };
}

describe('createLogger', () => {
  it('menyembunyikan data pribadi dan kredensial', () => {
    const { lines, destination } = captureLines();
    const logger = createLogger({ level: 'info', appName: 'Eklesia', destination });

    logger.info(
      {
        email: 'jemaat@contoh.id',
        phone: '081200000000',
        password: 'rahasia',
        nested: { amount: 500_000, nominal: 250_000, token: 'abc' },
      },
      'uji redaksi',
    );

    const entry = JSON.parse(lines.join('')) as Record<string, unknown>;
    expect(entry.email).toBe('[redacted]');
    expect(entry.phone).toBe('[redacted]');
    expect(entry.password).toBe('[redacted]');
    expect(entry.nested).toEqual({
      amount: '[redacted]',
      nominal: '[redacted]',
      token: '[redacted]',
    });
  });

  it('tetap menulis field operasional yang aman', () => {
    const { lines, destination } = captureLines();
    const logger = createLogger({ level: 'info', appName: 'Eklesia', destination });

    logger.info({ method: 'GET', path: '/api/health', status: 200 }, 'request selesai');

    const entry = JSON.parse(lines.join('')) as Record<string, unknown>;
    expect(entry.method).toBe('GET');
    expect(entry.path).toBe('/api/health');
    expect(entry.app).toBe('Eklesia');
    expect(entry.msg).toBe('request selesai');
  });
});
