import { Hono } from 'hono';
import { idParamSchema, inviteUserSchema, updateUserSchema } from '@eklesia/shared';
import type { Database } from '../db/client.js';
import type { AppConfig } from '../lib/env.js';
import type { Mailer } from '../lib/mailer.js';
import { currentUser, requirePermission } from '../middleware/permission.js';
import { createTenantMiddleware } from '../middleware/tenant.js';
import { jsonBody, pathParams } from '../middleware/validate.js';
import {
  inviteUser,
  listUsers,
  resendInvitation,
  updateUser,
} from '../modules/users/service.js';
import type { Logger } from 'pino';
import type { AppEnv } from '../types.js';

export interface UserRouteDependencies {
  /** Koneksi runtime (RLS aktif) untuk middleware tenant. */
  db: Database;
  /** Koneksi sistem untuk pemeriksaan email unik lintas gereja. */
  systemDb: Database;
  env: AppConfig;
  mailer: Mailer;
  logger: Logger;
}

export function createUserRoutes(deps: UserRouteDependencies) {
  const tenant = createTenantMiddleware({ db: deps.db });

  return new Hono<AppEnv>()
    .use('*', tenant)
    .get('/', requirePermission('users.manage'), async (c) => {
      return c.json({ items: await listUsers(c.get('db')) });
    })
    .post(
      '/invite',
      requirePermission('users.manage'),
      jsonBody(inviteUserSchema),
      async (c) => {
        const actor = currentUser(c);
        const result = await inviteUser(
          {
            systemDb: deps.systemDb,
            tenant: c.get('db'),
            env: deps.env,
            mailer: deps.mailer,
            logger: deps.logger,
          },
          c.req.valid('json'),
          actor.user.id,
          actor.church.name,
        );
        return c.json(result, 201);
      },
    )
    .post(
      '/:id/invite',
      requirePermission('users.manage'),
      pathParams(idParamSchema),
      async (c) => {
        const actor = currentUser(c);
        const result = await resendInvitation(
          {
            systemDb: deps.systemDb,
            tenant: c.get('db'),
            env: deps.env,
            mailer: deps.mailer,
            logger: deps.logger,
          },
          c.req.param('id'),
          actor.church.name,
        );
        return c.json(result);
      },
    )
    .patch(
      '/:id',
      requirePermission('users.manage'),
      pathParams(idParamSchema),
      jsonBody(updateUserSchema),
      async (c) => {
        const actor = currentUser(c);
        const result = await updateUser(
          { systemDb: deps.systemDb, tenant: c.get('db') },
          { id: actor.user.id, role: actor.user.role },
          c.req.param('id'),
          c.req.valid('json'),
        );
        return c.json(result);
      },
    );
}
