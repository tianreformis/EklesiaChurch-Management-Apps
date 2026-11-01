import { hc } from 'hono/client';
import type { AppType } from '@eklesia/api';

/**
 * Klien API bertipe (Hono RPC). Tipe request/response diambil langsung dari
 * `AppType` sehingga tidak ada definisi tipe ganda antara web dan api.
 *
 * Base URL relatif karena development memakai proxy Vite dan produksi memakai
 * satu origin (Hono menyajikan SPA).
 */
export const apiClient = hc<AppType>('/');
