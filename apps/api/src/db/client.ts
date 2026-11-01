import type { PgDatabase } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/postgres-js';
import type { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

/**
 * Koneksi database.
 *
 * Catatan penting: koneksi ini adalah koneksi "mentah" untuk keperluan sistem
 * (health check, autentikasi, migrasi, seed). Rute milik gereja WAJIB memakai
 * `c.var.db` dari middleware tenant (Fase 1) agar `church_id` selalu tersaring.
 */
export function createDatabase(connectionString: string) {
  const sql = postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {},
  });

  const db = drizzle(sql, { schema });

  return {
    sql,
    db,
    close: async (): Promise<void> => {
      await sql.end({ timeout: 5 });
    },
  };
}

/**
 * Tipe dasar Drizzle tanpa `$client`, sehingga transaksi (`tx`) juga memenuhi
 * tipe ini dan service dapat menerima koneksi maupun transaksi.
 */
export type Database = PgDatabase<PostgresJsQueryResultHKT, typeof schema>;
