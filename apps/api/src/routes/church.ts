import { Hono } from 'hono';
import { updateChurchSchema } from '@eklesia/shared';
import type { Database } from '../db/client.js';
import { currentUser, requirePermission } from '../middleware/permission.js';
import { createTenantMiddleware } from '../middleware/tenant.js';
import { jsonBody } from '../middleware/validate.js';
import { getChurch, updateChurch } from '../modules/church/service.js';
import { exportChurchData } from '../modules/church/export.js';
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
    })
    // Ekspor seluruh data gereja (backup admin, izin church.backup).
    .get('/export.xlsx', requirePermission('church.backup'), async (c) => {
      const actor = currentUser(c);
      const buffer = await exportChurchData(c.get('db'), { id: actor.user.id });
      c.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      c.header('Content-Disposition', 'attachment; filename="ekspor-data-gereja.xlsx"');
      return c.body(new Uint8Array(buffer));
    });
}
