import type { MiddlewareHandler } from 'hono';
import { hasPermission, type Permission } from '@eklesia/shared';
import { forbidden, unauthorized } from '../lib/errors.js';
import type { AuthUser } from '../types.js';
import type { AppEnv } from '../types.js';

/** Menolak permintaan tanpa sesi aktif. */
export function requireAuth(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (!c.get('auth')) {
      throw unauthorized();
    }
    await next();
  };
}

/**
 * Pemeriksaan izin di server memakai matriks bersama. Menyembunyikan tombol di
 * UI bukan keamanan.
 */
export function requirePermission(permission: Permission): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const auth = c.get('auth');
    if (!auth) {
      throw unauthorized();
    }
    if (auth.kind !== 'user') {
      throw forbidden('Akun platform tidak dapat mengakses data gereja.');
    }
    if (!hasPermission(auth.user.role, permission)) {
      throw forbidden();
    }
    await next();
  };
}

/** Rute platform: hanya super_admin, tidak pernah data gereja. */
export function requireSuperAdmin(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const auth = c.get('auth');
    if (!auth) {
      throw unauthorized();
    }
    if (auth.kind !== 'super_admin') {
      throw forbidden('Halaman ini hanya untuk pengelola platform.');
    }
    await next();
  };
}

export function currentUser(c: {
  get: <K extends keyof AppEnv['Variables']>(key: K) => AppEnv['Variables'][K];
}): AuthUser {
  const auth = c.get('auth');
  if (!auth || auth.kind !== 'user') {
    throw unauthorized();
  }
  return auth;
}
