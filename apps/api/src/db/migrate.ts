import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { loadEnvFile } from '../lib/load-env.js';
import { loadEnvOrExit } from '../lib/env.js';

const ROLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

function quoteIdent(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function quoteLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Peran runtime aplikasi hanya mendapat hak DML, bukan pemilik tabel. Dengan
 * begitu Row Level Security benar-benar berlaku untuk koneksi aplikasi.
 */
async function provisionAppRole(
  client: ReturnType<typeof postgres>,
  user: string,
  password: string,
): Promise<void> {
  if (!ROLE_NAME.test(user)) {
    throw new Error('APP_DB_USER hanya boleh berisi huruf, angka, dan garis bawah.');
  }
  const role = quoteIdent(user);
  const roleLiteral = quoteLiteral(user);

  await client.unsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${roleLiteral}) THEN
        CREATE ROLE ${role} LOGIN;
      END IF;
      EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), ${roleLiteral});
    END $$;
  `);
  await client.unsafe(`ALTER ROLE ${role} LOGIN PASSWORD ${quoteLiteral(password)}`);
  await client.unsafe(`GRANT USAGE ON SCHEMA public TO ${role}`);
  await client.unsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${role}`);
  await client.unsafe(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${role}`);
  await client.unsafe(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${role}`,
  );
  await client.unsafe(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${role}`,
  );
}

/**
 * Menjalankan semua migrasi yang belum diterapkan, lalu menyiapkan peran
 * aplikasi. Dijalankan sebagai layanan one-shot `migrate` sebelum app start.
 */
async function main(): Promise<void> {
  loadEnvFile();
  const env = loadEnvOrExit();

  const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));
  const connectionString = env.MIGRATION_DATABASE_URL ?? env.DATABASE_URL;
  const client = postgres(connectionString, { max: 1, onnotice: () => {} });

  try {
    await migrate(drizzle(client), { migrationsFolder });
    if (env.APP_DB_PASSWORD) {
      await provisionAppRole(client, env.APP_DB_USER, env.APP_DB_PASSWORD);
    } else {
      console.warn('APP_DB_PASSWORD kosong: peran aplikasi tidak disiapkan.');
    }
    console.warn('Migrasi database selesai.');
  } finally {
    await client.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  console.error('Migrasi database gagal:', error instanceof Error ? error.message : error);
  process.exit(1);
});
