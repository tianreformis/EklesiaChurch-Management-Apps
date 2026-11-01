import { sql } from 'drizzle-orm';
import type { MiddlewareHandler } from 'hono';
import type { Database } from '../db/client.js';
import { createTenantDb } from '../db/tenant.js';
import { unauthorized } from '../lib/errors.js';
import type { AppEnv } from '../types.js';

export interface TenantMiddlewareDependencies {
  db: Database;
}

/**
 * Membuka satu transaksi per permintaan, menetapkan `app.church_id` untuk RLS,
 * lalu menyediakan `c.var.db` yang selalu menyaring gereja dari sesi.
 *
 * `church_id` TIDAK PERNAH dibaca dari body, query, atau header.
 */
export function createTenantMiddleware(
  deps: TenantMiddlewareDependencies,
): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const auth = c.get('auth');
    if (!auth || auth.kind !== 'user') {
      throw unauthorized();
    }

    c.set('user', auth.user);
    c.set('church', auth.church);

    await deps.db.transaction(async (tx) => {
      await tx.execute(sql`select set_config('app.church_id', ${auth.user.churchId}, true)`);
      c.set('db', createTenantDb(tx as unknown as Database, auth.user.churchId));
      await next();
    });
  };
}
