import { serve } from '@hono/node-server';
import { sql } from 'drizzle-orm';
import { createApp } from './app.js';
import { createDatabase } from './db/client.js';
import { loadEnvFile } from './lib/load-env.js';
import { loadEnvOrExit } from './lib/env.js';
import { createLogger } from './lib/logger.js';
import { createMailer } from './lib/mailer.js';

loadEnvFile();
const env = loadEnvOrExit();

const logger = createLogger({
  level: env.LOG_LEVEL,
  appName: env.APP_NAME,
  pretty: env.NODE_ENV === 'development',
});

// Runtime memakai peran terbatas (RLS aktif); lapisan sistem memakai pemilik
// skema (migrasi/seed memakai URL yang sama dengan migrate).
const { db, close } = createDatabase(env.DATABASE_URL);
const system = createDatabase(env.MIGRATION_DATABASE_URL ?? env.DATABASE_URL);
const mailer = createMailer(env, logger);

const app = createApp({
  appName: env.APP_NAME,
  logger,
  db: db,
  systemDb: system.db,
  env,
  mailer,
  checkDatabase: async () => {
    await db.execute(sql`select 1`);
  },
  webDistPath: env.WEB_DIST_PATH,
});

const server = serve({ fetch: app.fetch, port: env.PORT, hostname: env.HOST }, (info) => {
  logger.info({ port: info.port, hostname: env.HOST, env: env.NODE_ENV }, 'server berjalan');
});

const shutdown = (signal: string): void => {
  logger.info({ signal }, 'menghentikan server');
  server.close(() => {
    void Promise.all([close(), system.close()]).finally(() => process.exit(0));
  });
  // Jangan menggantung selamanya bila koneksi tidak menutup.
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
