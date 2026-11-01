import { Hono } from 'hono';
import { updateChurchSchema } from '@eklesia/shared';
import type { Database } from '../db/client.js';
import { currentUser, requirePermission } from '../middleware/permission.js';
import { createTenantMiddleware } from '../middleware/tenant.js';
import { jsonBody } from '../middleware/validate.js';
import { getChurch, updateChurch } from '../modules/church/service.js';
import type { AppEnv } from '../types.js';

export function createChurchRoutes(deps: { db: Database }) {
  const tenant = createTenantMiddleware({ db: deps.db });

  return new Hono<AppEnv>()
    .use('*', tenant)
    .get('/', async (c) => {
      return c.json({ church: await getChurch(c.get('db')) });
    })
    .patch('/', requirePermission('church.manage'), jsonBody(updateChurchSchema), async (c) => {
      const actor = currentUser(c);
      const church = await updateChurch(c.get('db'), actor.user.id, c.req.valid('json'));
      return c.json({ church });
    });
}
