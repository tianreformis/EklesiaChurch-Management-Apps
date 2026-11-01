import { and, eq, gt } from 'drizzle-orm';
import type { MiddlewareHandler } from 'hono';
import type { Database } from '../db/client.js';
import { churches, sessions, superAdmins, users } from '../db/schema/index.js';
import { hashToken } from '../lib/tokens.js';
import { readSessionToken } from '../lib/cookies.js';
import type { AppEnv } from '../types.js';

export interface AuthMiddlewareDependencies {
  db: Database;
  cookieName: string;
}

const LAST_SEEN_INTERVAL_MS = 10 * 60 * 1000;

/**
 * Membaca cookie sesi, memverifikasi hash token ke database, lalu mengisi
 * `c.var.auth`. Middleware ini tidak menolak permintaan; rute yang membutuhkan
 * sesi memakai `requireAuth`.
 */
export function createAuthMiddleware(deps: AuthMiddlewareDependencies): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    c.set('auth', null);

    const token = readSessionToken(c, deps.cookieName);
    if (!token) {
      await next();
      return;
    }

    const now = new Date();
    const [session] = await deps.db
      .select()
      .from(sessions)
      .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, now)))
      .limit(1);

    if (!session) {
      await next();
      return;
    }

    if (session.userId) {
      const [row] = await deps.db
        .select({ user: users, church: churches })
        .from(users)
        .innerJoin(churches, eq(users.churchId, churches.id))
        .where(eq(users.id, session.userId))
        .limit(1);

      if (row && row.user.isActive && row.church.status === 'active') {
        c.set('auth', { kind: 'user', user: row.user, church: row.church });
      }
    } else if (session.superAdminId) {
      const [admin] = await deps.db
        .select()
        .from(superAdmins)
        .where(eq(superAdmins.id, session.superAdminId))
        .limit(1);

      if (admin && admin.isActive) {
        c.set('auth', { kind: 'super_admin', superAdmin: admin });
      }
    }

    // Menghindari satu UPDATE pada setiap permintaan.
    if (now.getTime() - session.lastSeenAt.getTime() > LAST_SEEN_INTERVAL_MS) {
      await deps.db.update(sessions).set({ lastSeenAt: now }).where(eq(sessions.id, session.id));
    }

    await next();
  };
}
