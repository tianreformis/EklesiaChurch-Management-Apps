import type { MiddlewareHandler } from 'hono';
import { tooManyRequests } from '../lib/errors.js';

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  /** Nama pembatas, dipakai sebagai bagian kunci. */
  name: string;
  windowMs: number;
  max: number;
}

const buckets = new Map<string, Bucket>();
let lastCleanup = Date.now();

function cleanup(now: number): void {
  if (now - lastCleanup < 60_000) {
    return;
  }
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

function clientKey(c: Parameters<MiddlewareHandler>[0]): string {
  const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || c.req.header('x-real-ip') || 'lokal';
}

/**
 * Pembatas laju sederhana di memori proses. Cukup untuk server gereja tunggal;
 * bila nanti berjalan banyak replika, ganti penyimpanannya dengan Redis/DB.
 */
export function rateLimit(options: RateLimitOptions): MiddlewareHandler {
  return async (c, next) => {
    const now = Date.now();
    cleanup(now);

    const key = `${options.name}:${clientKey(c)}`;
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      await next();
      return;
    }

    if (bucket.count >= options.max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      c.header('Retry-After', String(retryAfter));
      throw tooManyRequests(
        `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil(retryAfter / 60)} menit.`,
      );
    }

    bucket.count += 1;
    await next();
  };
}

/** Hanya untuk pengujian: mengosongkan penghitung. */
export function resetRateLimits(): void {
  buckets.clear();
}
