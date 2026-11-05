import { Hono } from 'hono';
import {
  createFamilySchema,
  createGroupSchema,
  createMemberSchema,
  createRegionSchema,
  idParamSchema,
  memberFilterSchema,
  setGroupMembersSchema,
  updateFamilySchema,
  updateGroupSchema,
  updateMemberSchema,
  updateRegionSchema,
} from '@eklesia/shared';
import type { Database } from '../db/client.js';
import type { AppConfig } from '../lib/env.js';
import type { Mailer } from '../lib/mailer.js';
import type { Logger } from 'pino';
import { currentUser, requirePermission } from '../middleware/permission.js';
import { createTenantMiddleware } from '../middleware/tenant.js';
import { jsonBody, pathParams, queryParams } from '../middleware/validate.js';
import type { AppEnv } from '../types.js';
import {
  addGroupMember,
  createFamily,
  createGroup,
  createMember,
  createRegion,
  deleteFamily,
  deleteGroup,
  deleteMember,
  deleteRegion,
  getMember,
  listBirthdaysThisMonth,
  listFamilies,
  listGroupMembers,
  listGroups,
  listMembers,
  listRegions,
  removeGroupMember,
  setGroupMembers,
  updateFamily,
  updateGroup,
  updateMember,
  updateRegion,
} from '../modules/members/service.js';

export interface MemberRouteDependencies {
  db: Database;
  systemDb: Database;
  env: AppConfig;
  mailer: Mailer;
  logger: Logger;
}

export function createMemberRoutes(deps: MemberRouteDependencies) {
  const tenant = createTenantMiddleware({ db: deps.db });
  void deps;

  return (
    new Hono<AppEnv>()
      .use('*', tenant)
      .get('/', requirePermission('members.read'), queryParams(memberFilterSchema), async (c) => {
        return c.json(await listMembers(c.get('db'), c.req.valid('query')));
      })
      .get(
        '/birthdays',
        requirePermission('members.read'),
        queryParams(memberFilterSchema.pick({ birthMonth: true }).partial()),
        async (c) => {
          const query = c.req.valid('query');
          const month = query.birthMonth ?? new Date().getMonth() + 1;
          return c.json({ items: await listBirthdaysThisMonth(c.get('db'), month), month });
        },
      )
      .get('/:id', requirePermission('members.read'), pathParams(idParamSchema), async (c) => {
        return c.json(await getMember(c.get('db'), c.req.param('id')));
      })
      .post('/', requirePermission('members.write'), jsonBody(createMemberSchema), async (c) => {
        const actor = currentUser(c);
        const result = await createMember(c.get('db'), { id: actor.user.id }, c.req.valid('json'));
        return c.json(result, 201);
      })
      .patch(
        '/:id',
        requirePermission('members.write'),
        pathParams(idParamSchema),
        jsonBody(updateMemberSchema),
        async (c) => {
          const actor = currentUser(c);
          return c.json(
            await updateMember(c.get('db'), { id: actor.user.id }, c.req.param('id'), c.req.valid('json')),
          );
        },
      )
      .delete('/:id', requirePermission('members.write'), pathParams(idParamSchema), async (c) => {
        const actor = currentUser(c);
        return c.json(await deleteMember(c.get('db'), { id: actor.user.id }, c.req.param('id')));
      })
      // Keluarga.
      .get('/meta/families', requirePermission('members.read'), async (c) => {
        return c.json({ items: await listFamilies(c.get('db')) });
      })
      .post(
        '/meta/families',
        requirePermission('members.write'),
        jsonBody(createFamilySchema),
        async (c) => {
          const actor = currentUser(c);
          const result = await createFamily(c.get('db'), { id: actor.user.id }, c.req.valid('json'));
          return c.json(result, 201);
        },
      )
      .patch(
        '/meta/families/:id',
        requirePermission('members.write'),
        pathParams(idParamSchema),
        jsonBody(updateFamilySchema),
        async (c) => {
          const actor = currentUser(c);
          return c.json(
            await updateFamily(c.get('db'), { id: actor.user.id }, c.req.param('id'), c.req.valid('json')),
          );
        },
      )
      .delete(
        '/meta/families/:id',
        requirePermission('members.write'),
        pathParams(idParamSchema),
        async (c) => {
          const actor = currentUser(c);
          return c.json(await deleteFamily(c.get('db'), { id: actor.user.id }, c.req.param('id')));
        },
      )
      // Wilayah.
      .get('/meta/regions', requirePermission('members.read'), async (c) => {
        return c.json({ items: await listRegions(c.get('db')) });
      })
      .post(
        '/meta/regions',
        requirePermission('members.write'),
        jsonBody(createRegionSchema),
        async (c) => {
          const actor = currentUser(c);
          const result = await createRegion(c.get('db'), { id: actor.user.id }, c.req.valid('json'));
          return c.json(result, 201);
        },
      )
      .patch(
        '/meta/regions/:id',
        requirePermission('members.write'),
        pathParams(idParamSchema),
        jsonBody(updateRegionSchema),
        async (c) => {
          const actor = currentUser(c);
          return c.json(
            await updateRegion(c.get('db'), { id: actor.user.id }, c.req.param('id'), c.req.valid('json')),
          );
        },
      )
      .delete(
        '/meta/regions/:id',
        requirePermission('members.write'),
        pathParams(idParamSchema),
        async (c) => {
          const actor = currentUser(c);
          return c.json(await deleteRegion(c.get('db'), { id: actor.user.id }, c.req.param('id')));
        },
      )
      // Komisi/tim.
      .get('/meta/groups', requirePermission('members.read'), async (c) => {
        return c.json({ items: await listGroups(c.get('db')) });
      })
      .post(
        '/meta/groups',
        requirePermission('members.write'),
        jsonBody(createGroupSchema),
        async (c) => {
          const actor = currentUser(c);
          const result = await createGroup(c.get('db'), { id: actor.user.id }, c.req.valid('json'));
          return c.json(result, 201);
        },
      )
      .patch(
        '/meta/groups/:id',
        requirePermission('members.write'),
        pathParams(idParamSchema),
        jsonBody(updateGroupSchema),
        async (c) => {
          const actor = currentUser(c);
          return c.json(
            await updateGroup(c.get('db'), { id: actor.user.id }, c.req.param('id'), c.req.valid('json')),
          );
        },
      )
      .delete(
        '/meta/groups/:id',
        requirePermission('members.write'),
        pathParams(idParamSchema),
        async (c) => {
          const actor = currentUser(c);
          return c.json(await deleteGroup(c.get('db'), { id: actor.user.id }, c.req.param('id')));
        },
      )
      .get(
        '/meta/groups/:id/members',
        requirePermission('members.read'),
        pathParams(idParamSchema),
        async (c) => {
          return c.json({ items: await listGroupMembers(c.get('db'), c.req.param('id')) });
        },
      )
      .put(
        '/meta/groups/:id/members',
        requirePermission('members.write'),
        pathParams(idParamSchema),
        jsonBody(setGroupMembersSchema),
        async (c) => {
          const actor = currentUser(c);
          return c.json(
            await setGroupMembers(c.get('db'), { id: actor.user.id }, c.req.param('id'), c.req.valid('json')),
          );
        },
      )
      .post(
        '/meta/groups/:id/members/:memberId',
        requirePermission('members.write'),
        async (c) => {
          const actor = currentUser(c);
          return c.json(
            await addGroupMember(c.get('db'), { id: actor.user.id }, c.req.param('id'), c.req.param('memberId')),
            201,
          );
        },
      )
      .delete(
        '/meta/groups/:id/members/:memberId',
        requirePermission('members.write'),
        async (c) => {
          const actor = currentUser(c);
          return c.json(
            await removeGroupMember(c.get('db'), { id: actor.user.id }, c.req.param('id'), c.req.param('memberId')),
          );
        },
      )
  );
}
