import { Hono } from 'hono';

export type DatabaseCheck = () => Promise<void>;

export interface HealthRouteDependencies {
  appName: string;
  checkDatabase: DatabaseCheck;
}

/**
 * `GET /api/health` — dipakai healthcheck Docker Compose dan pemantauan.
 * Endpoint ini tidak memerlukan autentikasi dan tidak memuat data gereja.
 */
export function createHealthRoutes(deps: HealthRouteDependencies) {
  return new Hono().get('/', async (c) => {
    const startedAt = performance.now();
    const checkedAt = new Date().toISOString();

    try {
      await deps.checkDatabase();
      return c.json(
        {
          status: 'ok' as const,
          app: deps.appName,
          database: 'ok' as const,
          uptimeSeconds: Math.round(process.uptime()),
          checkedAt,
          latencyMs: Math.round(performance.now() - startedAt),
        },
        200,
      );
    } catch {
      // Detail error koneksi tidak dikirim ke klien (bisa memuat kredensial).
      return c.json(
        {
          status: 'degraded' as const,
          app: deps.appName,
          database: 'unavailable' as const,
          uptimeSeconds: Math.round(process.uptime()),
          checkedAt,
          latencyMs: Math.round(performance.now() - startedAt),
        },
        503,
      );
    }
  });
}
