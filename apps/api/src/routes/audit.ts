import { Hono } from 'hono';
import { paginationSchema } from '@eklesia/shared';
import type { Database } from '../db/client.js';
import { requirePermission } from '../middleware/permission.js';
import { createTenantMiddleware } from '../middleware/tenant.js';
import { queryParams } from '../middleware/validate.js';
import { listAuditLogs } from '../modules/audit/service.js';
import type { AppEnv } from '../types.js';

export function createAuditRoutes(deps: { db: Database }) {
  const tenant = createTenantMiddleware({ db: deps.db });

  return new Hono<AppEnv>().use('*', tenant).get(
    '/',
    requirePermission('finance.audit'),
    queryParams(paginationSchema),
    async (c) => {
      return c.json(await listAuditLogs(c.get('db'), c.req.valid('query')));
    },
  );
}
