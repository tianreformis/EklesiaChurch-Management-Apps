import { Hono } from 'hono';
import {
  createChurchSchema,
  idParamSchema,
  updateChurchStatusSchema,
} from '@eklesia/shared';
import type { Database } from '../db/client.js';
import type { AppConfig } from '../lib/env.js';
import { unauthorized } from '../lib/errors.js';
import type { Mailer } from '../lib/mailer.js';
import { requireSuperAdmin } from '../middleware/permission.js';
import { jsonBody, pathParams } from '../middleware/validate.js';
import {
  createChurch,
  getSummary,
  listChurches,
  updateChurchStatus,
} from '../modules/platform/service.js';
import type { Logger } from 'pino';
import type { AppEnv } from '../types.js';

export interface PlatformRouteDependencies {
  db: Database;
  env: AppConfig;
  mailer: Mailer;
  logger: Logger;
}

/** Rute pemilik platform. Tidak pernah menyentuh data jemaat atau keuangan. */
export function createPlatformRoutes(deps: PlatformRouteDependencies) {
  return new Hono<AppEnv>()
    .use('*', requireSuperAdmin())
    .get('/summary', async (c) => {
      return c.json(await getSummary(deps.db));
    })
    .get('/churches', async (c) => {
      return c.json({ items: await listChurches(deps.db) });
    })
    .post('/churches', jsonBody(createChurchSchema), async (c) => {
      const auth = c.get('auth');
      if (!auth || auth.kind !== 'super_admin') {
        throw unauthorized();
      }
      const result = await createChurch(deps, c.req.valid('json'));
      return c.json(result, 201);
    })
    .patch(
      '/churches/:id',
      pathParams(idParamSchema),
      jsonBody(updateChurchStatusSchema),
      async (c) => {
        const church = await updateChurchStatus(deps, c.req.param('id'), c.req.valid('json'));
        return c.json({ church });
      },
    );
}
