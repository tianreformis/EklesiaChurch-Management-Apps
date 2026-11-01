import { defineConfig } from 'drizzle-kit';

/**
 * Konfigurasi drizzle-kit. Hanya dipakai untuk menjalankan/membuat migrasi;
 * kredensial asli selalu datang dari environment saat runtime.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  strict: true,
  verbose: true,
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://eklesia:eklesia@127.0.0.1:5432/eklesia',
  },
});
