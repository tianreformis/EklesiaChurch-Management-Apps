import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { loadEnvFile } from '../lib/load-env.js';
import { loadEnvOrExit } from '../lib/env.js';

/**
 * Menjalankan semua migrasi yang belum diterapkan. Dijalankan sebagai layanan
 * one-shot `migrate` di Docker Compose sebelum aplikasi start.
 */
async function main(): Promise<void> {
  loadEnvFile();
  const env = loadEnvOrExit();

  const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));
  const client = postgres(env.DATABASE_URL, { max: 1, onnotice: () => {} });

  try {
    await migrate(drizzle(client), { migrationsFolder });
    console.warn('Migrasi database selesai.');
  } finally {
    await client.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  console.error('Migrasi database gagal:', error instanceof Error ? error.message : error);
  process.exit(1);
});
