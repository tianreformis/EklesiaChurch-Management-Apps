import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

/**
 * Koneksi database.
 *
 * Catatan penting: koneksi ini adalah koneksi "mentah" untuk keperluan sistem
 * (health check, migrasi, seed). Rute milik gereja WAJIB memakai `getTenantDb`
 * dari middleware tenant (Fase 1) agar `church_id` selalu tersaring.
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

export type Database = ReturnType<typeof createDatabase>['db'];
