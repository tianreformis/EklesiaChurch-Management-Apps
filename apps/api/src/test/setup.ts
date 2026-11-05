import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { drizzle } from 'drizzle-orm/postgres-js';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://eklesia:EklesiaLocalDev9mQ4tZ@127.0.0.1:55432/eklesia_test';

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

/**
 * Membuat database uji bila belum ada (mis. setelah volume Docker dihapus),
 * agar test integrasi bisa jalan dari mesin bersih.
 */
async function ensureTestDatabase(): Promise<void> {
  const adminUrl = TEST_DATABASE_URL.replace(/\/[^/]+$/, '/eklesia');
  const client = postgres(adminUrl, { max: 1, onnotice: () => {} });
  try {
    const rows = await client.unsafe(
      `SELECT 1 FROM pg_database WHERE datname = 'eklesia_test'`,
    );
    if (rows.length === 0) {
      await client.unsafe(`CREATE DATABASE eklesia_test`);
    }
  } finally {
    await client.end({ timeout: 5 });
  }
}

/**
 * Menjalankan migrasi ke database uji sebelum test integrasi. File test
 * berjalan paralel, jadi migrasi dikunci dengan advisory lock agar tidak
 * saling menabrak ("tuple concurrently updated").
 */
export async function migrateTestDatabase(): Promise<void> {
  await ensureTestDatabase();
  const client = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
  try {
    await client.unsafe(`SELECT pg_advisory_lock(20261105)`);
    try {
      await migrate(drizzle(client), { migrationsFolder });
      // Peran aplikasi perlu hak atas tabel baru di database uji.
      await client.unsafe(`GRANT USAGE ON SCHEMA public TO eklesia_app`);
      await client.unsafe(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO eklesia_app`,
      );
      await client.unsafe(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO eklesia_app`);
    } finally {
      await client.unsafe(`SELECT pg_advisory_unlock(20261105)`);
    }
  } finally {
    await client.end({ timeout: 5 });
  }
}

export function testOwnerUrl(): string {
  return TEST_DATABASE_URL;
}

export function testAppUrl(): string {
  return TEST_DATABASE_URL.replace(
    'eklesia:EklesiaLocalDev9mQ4tZ',
    'eklesia_app:EklesiaAppLocal7wR2pL',
  );
}
