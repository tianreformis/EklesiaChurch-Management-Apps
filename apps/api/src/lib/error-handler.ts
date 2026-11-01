import { HTTPException } from 'hono/http-exception';
import type { ErrorHandler, NotFoundHandler } from 'hono';
import type { Logger } from 'pino';

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}

/**
 * Penanganan error terpusat. Detail internal tidak dikirim ke klien; hanya
 * dicatat di log server.
 */
export function createErrorHandler(logger: Logger): ErrorHandler {
  return (error, c) => {
    if (error instanceof HTTPException) {
      const status = error.status;
      logger.warn(
        { status, method: c.req.method, path: c.req.path, reason: error.message },
        'request ditolak',
      );
      const body: ApiErrorBody = {
        error: {
          code: status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR',
          message: error.message,
        },
      };
      return c.json(body, status);
    }

    logger.error({ err: error, method: c.req.method, path: c.req.path }, 'error tidak tertangani');
    const body: ApiErrorBody = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Terjadi kesalahan pada server. Silakan coba lagi.',
      },
    };
    return c.json(body, 500);
  };
}

export const notFoundHandler: NotFoundHandler = (c) => {
  if (c.req.path === '/api' || c.req.path.startsWith('/api/')) {
    const body: ApiErrorBody = {
      error: { code: 'NOT_FOUND', message: 'Rute API tidak ditemukan.' },
    };
    return c.json(body, 404);
  }
  return c.text('Halaman tidak ditemukan.', 404);
};
