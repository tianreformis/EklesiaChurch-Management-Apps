import { Hono } from 'hono';
import type { Logger } from 'pino';
import { createErrorHandler, notFoundHandler } from './lib/error-handler.js';
import { registerSpa } from './lib/spa.js';
import { createRequestLogger } from './middleware/request-logger.js';
import { createHealthRoutes, type DatabaseCheck } from './routes/health.js';

export interface AppDependencies {
  appName: string;
  logger: Logger;
  checkDatabase: DatabaseCheck;
  /**
   * Path absolut/relatif ke folder hasil build SPA. Bila diisi dan berisi
   * `index.html`, Hono menyajikan SPA (mode produksi). Dikosongkan saat dev
   * karena Vite yang melayani frontend.
   */
  webDistPath?: string;
}

/**
 * Membangun aplikasi Hono. Semua dependensi eksternal disuntikkan supaya app
 * bisa diuji tanpa PostgreSQL.
 *
 * Tipe hasil fungsi ini diekspor sebagai `AppType` dan dipakai frontend lewat
 * Hono RPC (`hc<AppType>`), sehingga tipe request/response tidak ditulis ulang.
 */
export function createApp(deps: AppDependencies) {
  const api = new Hono().route(
    '/health',
    createHealthRoutes({ appName: deps.appName, checkDatabase: deps.checkDatabase }),
  );

  // Rantai route dipertahankan agar tipe rute ikut terbawa ke `AppType`
  // (dibutuhkan Hono RPC di frontend).
  const app = new Hono()
    .use('*', createRequestLogger(deps.logger))
    .onError(createErrorHandler(deps.logger))
    .notFound(notFoundHandler)
    .route('/api', api);

  if (deps.webDistPath) {
    registerSpa(app, deps.webDistPath);
  }

  return app;
}

export type AppType = ReturnType<typeof createApp>;
