import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { serveStatic } from '@hono/node-server/serve-static';
import type { Hono } from 'hono';

/**
 * Menyajikan hasil build SPA dari Hono (satu origin).
 *
 * - Aset statis yang ada dikirim apa adanya.
 * - Rute non-`/api` yang tidak cocok file apa pun mendapat `index.html`
 *   sehingga React Router bisa menangani navigasi.
 * - Path `/api/*` tidak pernah jatuh ke `index.html`.
 */
export function registerSpa(app: Hono, webDistPath: string): boolean {
  const indexPath = join(webDistPath, 'index.html');
  if (!existsSync(indexPath)) {
    return false;
  }

  app.use('*', serveStatic({ root: webDistPath }));

  const serveIndex = serveStatic({ root: webDistPath, path: 'index.html' });
  app.get('*', (c, next) => {
    if (c.req.path === '/api' || c.req.path.startsWith('/api/')) {
      return next();
    }
    c.header('Cache-Control', 'no-cache');
    return serveIndex(c, next);
  });

  return true;
}
