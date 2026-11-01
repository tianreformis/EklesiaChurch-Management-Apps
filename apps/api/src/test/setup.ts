import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { drizzle } from 'drizzle-orm/postgres-js';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://eklesia:EklesiaLocalDev9mQ4tZ@127.0.0.1:55432/eklesia_test';

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

/** Menjalankan migrasi ke database uji sekali sebelum semua test integrasi. */
export async function migrateTestDatabase(): Promise<void> {
  const client = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(client), { migrationsFolder });
    // Peran aplikasi perlu hak atas tabel baru di database uji.
    await client.unsafe(`GRANT USAGE ON SCHEMA public TO eklesia_app`);
    await client.unsafe(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO eklesia_app`,
    );
    await client.unsafe(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO eklesia_app`);
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
