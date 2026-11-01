import type { MiddlewareHandler } from 'hono';
import type { Logger } from 'pino';

/**
 * Log akses ringkas. Query string tidak dicatat karena bisa memuat data pribadi
 * (mis. pencarian nomor HP).
 */
export function createRequestLogger(logger: Logger): MiddlewareHandler {
  return async (c, next) => {
    const startedAt = performance.now();
    const requestId = crypto.randomUUID();
    c.header('X-Request-Id', requestId);

    await next();

    logger.info(
      {
        requestId,
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        durationMs: Math.round(performance.now() - startedAt),
      },
      'request selesai',
    );
  };
}
