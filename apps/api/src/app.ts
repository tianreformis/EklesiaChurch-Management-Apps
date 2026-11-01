import { Hono } from 'hono';
import { csrf } from 'hono/csrf';
import { secureHeaders } from 'hono/secure-headers';
import type { Logger } from 'pino';
import type { Database } from './db/client.js';
import type { AppConfig } from './lib/env.js';
import { createErrorHandler, notFoundHandler } from './lib/error-handler.js';
import type { Mailer } from './lib/mailer.js';
import { registerSpa } from './lib/spa.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { createRequestLogger } from './middleware/request-logger.js';
import { createAuditRoutes } from './routes/audit.js';
import { createAuthRoutes } from './routes/auth.js';
import { createChurchRoutes } from './routes/church.js';
import { createHealthRoutes, type DatabaseCheck } from './routes/health.js';
import { createPlatformRoutes } from './routes/platform.js';
import { createUserRoutes } from './routes/users.js';
import type { AppEnv } from './types.js';

export interface AppDependencies {
  appName: string;
  logger: Logger;
  /**
   * Koneksi runtime (peran terbatas `eklesia_app`, RLS aktif). Dipakai semua
   * rute milik gereja lewat middleware tenant.
   */
  db: Database;
  /**
   * Koneksi sistem (pemilik skema, melewati RLS). Hanya dipakai lapisan sistem
   * yang sempit: autentikasi, pemeriksaan email unik lintas gereja, dan rute
   * platform. Tidak pernah dipakai untuk membaca data milik gereja berdasarkan
   * input klien.
   */
  systemDb: Database;
  env: AppConfig;
  mailer: Mailer;
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
  const auth = createAuthMiddleware({
    db: deps.systemDb,
    cookieName: deps.env.SESSION_COOKIE_NAME,
  });

  const api = new Hono<AppEnv>()
    .use('*', auth)
    .route(
      '/health',
      createHealthRoutes({ appName: deps.appName, checkDatabase: deps.checkDatabase }),
    )
    .route(
      '/auth',
      createAuthRoutes({
        db: deps.systemDb,
        env: deps.env,
        mailer: deps.mailer,
        logger: deps.logger,
      }),
    )
    .route('/users', createUserRoutes(deps))
    .route('/church', createChurchRoutes(deps))
    .route('/audit', createAuditRoutes(deps))
    .route('/platform', createPlatformRoutes({ ...deps, db: deps.systemDb }));

  // Rantai route dipertahankan agar tipe rute ikut terbawa ke `AppType`
  // (dibutuhkan Hono RPC di frontend).
  const app = new Hono()
    .use('*', createRequestLogger(deps.logger))
    .use(
      '*',
      secureHeaders({
        // CSP ketat. `style-src` mengizinkan inline style karena komponen UI
        // memakai style bawaan Radix; skrip tetap hanya dari origin sendiri.
        contentSecurityPolicy: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          fontSrc: ["'self'", 'data:'],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          objectSrc: ["'none'"],
        },
        // Tidak dipakai karena tidak ada iframe/worker lintas origin.
        crossOriginEmbedderPolicy: false,
      }),
    )
    // Semua permintaan yang mengubah data wajib berasal dari origin sendiri.
    .use('/api/*', csrf())
    .onError(createErrorHandler(deps.logger))
    .notFound(notFoundHandler)
    .route('/api', api);

  if (deps.webDistPath) {
    registerSpa(app, deps.webDistPath);
  }

  return app;
}

export type AppType = ReturnType<typeof createApp>;

// Tipe respons dipakai juga oleh frontend lewat Hono RPC agar tidak ditulis
// ulang secara manual.
export type { Profile, ProfileUser, ProfileSuperAdmin } from './modules/auth/service.js';
export type { PublicUser } from './modules/users/service.js';
export type { ChurchProfile } from './modules/church/service.js';
export type { PlatformChurch, PlatformSummary } from './modules/platform/service.js';
export type { AuditLogItem } from './modules/audit/service.js';
