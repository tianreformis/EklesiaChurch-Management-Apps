import { Hono } from 'hono';
import { z } from 'zod';
import {
  createAssignmentSchema,
  createServiceRoleSchema,
  createServiceSchema,
  createSwapRequestSchema,
  idParamSchema,
  remindServiceSchema,
  respondAssignmentSchema,
  respondSwapSchema,
  serviceFilterSchema,
  updateReminderTemplateSchema,
  updateServiceRoleSchema,
  updateServiceSchema,
  type ReminderChannel,
} from '@eklesia/shared';
import type { Database } from '../db/client.js';
import type { AppConfig } from '../lib/env.js';
import type { Mailer } from '../lib/mailer.js';
import type { Logger } from 'pino';
import { currentUser, requirePermission } from '../middleware/permission.js';
import { createTenantMiddleware } from '../middleware/tenant.js';
import { jsonBody, pathParams, queryParams } from '../middleware/validate.js';
import type { AppEnv } from '../types.js';
import { buildMonthlySchedulePdf } from '../modules/schedule/pdf.js';
import {
  approveSwapRequest,
  cancelSwapRequest,
  createAssignment,
  createRole,
  createServices,
  createSwapRequest,
  deleteAssignment,
  deleteRole,
  deleteService,
  getService,
  listMyAssignments,
  listRoles,
  listServices,
  listSwapRequests,
  listTemplates,
  remindService,
  respondAssignment,
  respondSwapRequest,
  updateRole,
  updateService,
  updateTemplate,
} from '../modules/schedule/service.js';

export interface ScheduleRouteDependencies {
  db: Database;
  systemDb: Database;
  env: AppConfig;
  mailer: Mailer;
  logger: Logger;
}

const assignmentIdParam = z.object({ assignmentId: z.string().uuid('Penugasan tidak valid.') });
const monthQuery = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Gunakan format bulan YYYY-MM.'),
});

export function createScheduleRoutes(deps: ScheduleRouteDependencies) {
  const tenant = createTenantMiddleware({ db: deps.db });
  const actor = (c: Parameters<typeof currentUser>[0]) => {
    const auth = currentUser(c);
    return { id: auth.user.id, role: auth.user.role };
  };

  return new Hono<AppEnv>()
    .use('*', tenant)
    // Peran pelayanan.
    .get('/roles', requirePermission('schedule.read'), async (c) => {
      return c.json({ items: await listRoles(c.get('db')) });
    })
    .post('/roles', requirePermission('schedule.write'), jsonBody(createServiceRoleSchema), async (c) => {
      return c.json(await createRole(c.get('db'), actor(c), c.req.valid('json')), 201);
    })
    .patch(
      '/roles/:id',
      requirePermission('schedule.write'),
      pathParams(idParamSchema),
      jsonBody(updateServiceRoleSchema),
      async (c) => {
        return c.json(await updateRole(c.get('db'), actor(c), c.req.param('id'), c.req.valid('json')));
      },
    )
    .delete('/roles/:id', requirePermission('schedule.write'), pathParams(idParamSchema), async (c) => {
      return c.json(await deleteRole(c.get('db'), actor(c), c.req.param('id')));
    })
    // Ibadah.
    .get('/services', requirePermission('schedule.read'), queryParams(serviceFilterSchema), async (c) => {
      return c.json({ items: await listServices(c.get('db'), c.req.valid('query')) });
    })
    .post('/services', requirePermission('schedule.write'), jsonBody(createServiceSchema), async (c) => {
      return c.json({ items: await createServices(c.get('db'), actor(c), c.req.valid('json')) }, 201);
    })
    .get('/services/:id', requirePermission('schedule.read'), pathParams(idParamSchema), async (c) => {
      return c.json(await getService(c.get('db'), c.req.param('id')));
    })
    .patch(
      '/services/:id',
      requirePermission('schedule.write'),
      pathParams(idParamSchema),
      jsonBody(updateServiceSchema),
      async (c) => {
        return c.json(await updateService(c.get('db'), actor(c), c.req.param('id'), c.req.valid('json')));
      },
    )
    .delete('/services/:id', requirePermission('schedule.write'), pathParams(idParamSchema), async (c) => {
      return c.json(await deleteService(c.get('db'), actor(c), c.req.param('id')));
    })
    // Penugasan.
    .post('/assignments', requirePermission('schedule.assign'), jsonBody(createAssignmentSchema), async (c) => {
      return c.json(await createAssignment(c.get('db'), actor(c), c.req.valid('json')), 201);
    })
    .delete(
      '/assignments/:assignmentId',
      requirePermission('schedule.assign'),
      pathParams(assignmentIdParam),
      async (c) => {
        return c.json(await deleteAssignment(c.get('db'), actor(c), c.req.param('assignmentId')));
      },
    )
    // Jadwal saya.
    .get('/mine', requirePermission('schedule.read'), async (c) => {
      const auth = currentUser(c);
      return c.json(await listMyAssignments(c.get('db'), auth.user.id));
    })
    .patch(
      '/assignments/:assignmentId/respond',
      requirePermission('schedule.read'),
      pathParams(assignmentIdParam),
      jsonBody(respondAssignmentSchema),
      async (c) => {
        const auth = currentUser(c);
        return c.json(
          await respondAssignment(c.get('db'), auth.user.id, c.req.param('assignmentId'), c.req.valid('json').status),
        );
      },
    )
    // Tukar jadwal.
    .get('/swaps', requirePermission('schedule.read'), async (c) => {
      return c.json({ items: await listSwapRequests(c.get('db'), actor(c)) });
    })
    .post('/swaps', requirePermission('schedule.swap.request'), jsonBody(createSwapRequestSchema), async (c) => {
      const auth = currentUser(c);
      return c.json(await createSwapRequest(c.get('db'), auth.user.id, c.req.valid('json')), 201);
    })
    .post(
      '/swaps/:id/respond',
      requirePermission('schedule.read'),
      pathParams(idParamSchema),
      jsonBody(respondSwapSchema),
      async (c) => {
        const auth = currentUser(c);
        return c.json(await respondSwapRequest(c.get('db'), auth.user.id, c.req.param('id'), c.req.valid('json').accept));
      },
    )
    .post(
      '/swaps/:id/approve',
      requirePermission('schedule.swap.approve'),
      pathParams(idParamSchema),
      jsonBody(respondSwapSchema),
      async (c) => {
        return c.json(await approveSwapRequest(c.get('db'), actor(c), c.req.param('id'), c.req.valid('json').accept));
      },
    )
    .post('/swaps/:id/cancel', requirePermission('schedule.read'), pathParams(idParamSchema), async (c) => {
      const auth = currentUser(c);
      return c.json(await cancelSwapRequest(c.get('db'), auth.user.id, c.req.param('id')));
    })
    // Template pengingat.
    .get('/templates', requirePermission('schedule.read'), async (c) => {
      return c.json({ items: await listTemplates(c.get('db')) });
    })
    .put(
      '/templates/:channel',
      requirePermission('schedule.write'),
      jsonBody(updateReminderTemplateSchema),
      async (c) => {
        const channel = c.req.param('channel') as ReminderChannel;
        if (channel !== 'whatsapp' && channel !== 'email') {
          return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Kanal tidak dikenal.' } }, 400);
        }
        return c.json(await updateTemplate(c.get('db'), actor(c), channel, c.req.valid('json')));
      },
    )
    // Pengingat per ibadah.
    .post(
      '/services/:id/remind',
      requirePermission('schedule.remind'),
      pathParams(idParamSchema),
      jsonBody(remindServiceSchema),
      async (c) => {
        const result = await remindService(
          c.get('db'),
          actor(c),
          c.req.param('id'),
          c.req.valid('json').sendEmail,
          deps.mailer,
        );
        return c.json(result);
      },
    )
    // PDF jadwal bulanan (dibuat di server).
    .get('/monthly.pdf', requirePermission('schedule.read'), queryParams(monthQuery), async (c) => {
      const auth = currentUser(c);
      const buffer = await buildMonthlySchedulePdf(c.get('db'), auth.church.name, c.req.valid('query').month);
      c.header('Content-Type', 'application/pdf');
      c.header('Content-Disposition', `attachment; filename="jadwal-${c.req.valid('query').month}.pdf"`);
      return c.body(new Uint8Array(buffer));
    });
}
