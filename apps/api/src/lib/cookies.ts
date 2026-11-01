import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { Context } from 'hono';

export interface SessionCookieOptions {
  name: string;
  maxAgeSeconds: number;
  secure: boolean;
}

/** Cookie `secure` hanya saat aplikasi memang diakses lewat HTTPS. */
export function isSecureBaseUrl(baseUrl: string): boolean {
  return baseUrl.trim().toLowerCase().startsWith('https://');
}

export function readSessionToken(c: Context, name: string): string | undefined {
  return getCookie(c, name);
}

export function writeSessionCookie(c: Context, token: string, options: SessionCookieOptions): void {
  setCookie(c, options.name, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: options.secure,
    path: '/',
    maxAge: options.maxAgeSeconds,
  });
}

export function clearSessionCookie(c: Context, name: string): void {
  deleteCookie(c, name, { path: '/' });
}
