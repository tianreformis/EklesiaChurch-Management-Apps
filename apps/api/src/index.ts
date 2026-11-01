import { serve } from '@hono/node-server';
import { sql } from 'drizzle-orm';
import { createApp } from './app.js';
import { createDatabase } from './db/client.js';
import { loadEnvFile } from './lib/load-env.js';
import { loadEnvOrExit } from './lib/env.js';
import { createLogger } from './lib/logger.js';

loadEnvFile();
const env = loadEnvOrExit();

const logger = createLogger({
  level: env.LOG_LEVEL,
  appName: env.APP_NAME,
  pretty: env.NODE_ENV === 'development',
});

const { db, close } = createDatabase(env.DATABASE_URL);

const app = createApp({
  appName: env.APP_NAME,
  logger,
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
    void close().finally(() => process.exit(0));
  });
  // Jangan menggantung selamanya bila koneksi tidak menutup.
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
