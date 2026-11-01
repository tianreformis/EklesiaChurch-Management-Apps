import type { MiddlewareHandler } from 'hono';
import { forbidden } from '../lib/errors.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export interface SameOriginOptions {
  /**
   * Origin tambahan yang dipercaya, misalnya alamat dev server Vite saat
   * development memakai proxy (`http://127.0.0.1:5173`). Di produksi aplikasi
   * berjalan satu origin sehingga daftar ini biasanya hanya berisi satu entri
   * yang sama dengan origin permintaan.
   */
  trustedOrigins?: readonly string[];
}

function requestOrigin(c: Parameters<MiddlewareHandler>[0]): string {
  return new URL(c.req.url).origin;
}

function headerOrigin(value: string | undefined, requestUrl: string): string | null {
  if (!value) {
    return null;
  }
  try {
    // Referer memuat path; ambil originnya saja.
    return new URL(value, requestUrl).origin;
  } catch {
    return null;
  }
}

/**
 * Perlindungan CSRF untuk API JSON.
 *
 * Middleware `hono/csrf` bawaan hanya memeriksa permintaan dengan content-type
 * formulir, sehingga permintaan `application/json` lolos tanpa diperiksa.
 * Middleware ini menutup celah tersebut: setiap permintaan yang mengubah data
 * (non-GET/HEAD/OPTIONS) wajib membawa header `Origin`/`Referer` yang cocok
 * dengan origin aplikasi. Browser selalu mengirim salah satunya pada
 * permintaan lintas situs, sedangkan klien non-browser (curl, skrip) yang
 * tidak mengirim header tetap diizinkan.
 */
export function sameOrigin(options: SameOriginOptions = {}): MiddlewareHandler {
  const trusted = new Set(options.trustedOrigins ?? []);
  return async (c, next) => {
    if (SAFE_METHODS.has(c.req.method)) {
      await next();
      return;
    }

    const expected = requestOrigin(c);
    const candidates = [
      headerOrigin(c.req.header('Origin'), c.req.url),
      headerOrigin(c.req.header('Referer'), c.req.url),
    ].filter((value): value is string => value !== null);

    if (candidates.length === 0) {
      await next();
      return;
    }

    const allowed = candidates.some(
      (candidate) => candidate === expected || trusted.has(candidate),
    );
    if (!allowed) {
      throw forbidden('Permintaan ditolak karena asal permintaan tidak dikenal.');
    }
    await next();
  };
}
