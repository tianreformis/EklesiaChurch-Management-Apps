import type { ContentfulStatusCode } from 'hono/utils/http-status';

/**
 * Error aplikasi dengan status HTTP dan kode stabil untuk klien.
 * Pesan selalu dalam Bahasa Indonesia dan aman ditampilkan ke pengguna.
 */
export class AppError extends Error {
  constructor(
    public readonly status: ContentfulStatusCode,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string, code = 'BAD_REQUEST'): AppError =>
  new AppError(400, code, message);

export const unauthorized = (message = 'Anda harus masuk terlebih dahulu.'): AppError =>
  new AppError(401, 'UNAUTHORIZED', message);

export const forbidden = (message = 'Anda tidak memiliki izin untuk tindakan ini.'): AppError =>
  new AppError(403, 'FORBIDDEN', message);

export const notFound = (message = 'Data tidak ditemukan.'): AppError =>
  new AppError(404, 'NOT_FOUND', message);

export const conflict = (message: string, code = 'CONFLICT'): AppError =>
  new AppError(409, code, message);

export const tooManyRequests = (
  message = 'Terlalu banyak percobaan. Coba lagi beberapa saat lagi.',
): AppError => new AppError(429, 'RATE_LIMITED', message);
