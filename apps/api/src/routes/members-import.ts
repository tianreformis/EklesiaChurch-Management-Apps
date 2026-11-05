import { Hono } from 'hono';
import type { Database } from '../db/client.js';
import type { AppConfig } from '../lib/env.js';
import type { Mailer } from '../lib/mailer.js';
import type { Logger } from 'pino';
import { badRequest } from '../lib/errors.js';
import { currentUser, requirePermission } from '../middleware/permission.js';
import { createTenantMiddleware } from '../middleware/tenant.js';
import { jsonBody } from '../middleware/validate.js';
import type { AppEnv } from '../types.js';
import { z } from 'zod';
import {
  IMPORT_MAX_BYTES,
  assertImportSize,
  buildImportTemplate,
  confirmImport,
  exportMembers,
  previewImport,
} from '../modules/members/excel.js';

export interface MemberImportRouteDependencies {
  db: Database;
  env: AppConfig;
  mailer: Mailer;
  logger: Logger;
}

const confirmSchema = z.object({
  choices: z
    .array(z.object({ rowNumber: z.number().int(), action: z.enum(['skip', 'update']) }))
    .max(5000),
});

const exportQuerySchema = z.object({
  status: z.enum(['aktif', 'pindah', 'meninggal', 'tidak_aktif']).optional(),
  regionId: z.string().uuid().optional(),
});

/**
 * Impor/ekspor Excel data jemaat. Unggahan dibatasi 5 MB; pratinjau tidak
 * menulis apa pun; konfirmasi wajib menyertakan pilihan per baris duplikat.
 */
export function createMemberImportRoutes(deps: MemberImportRouteDependencies) {
  const tenant = createTenantMiddleware({ db: deps.db });
  void deps;

  return new Hono<AppEnv>()
    .use('*', tenant)
    .get('/template', requirePermission('members.import'), async (c) => {
      const buffer = await buildImportTemplate();
      c.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      c.header('Content-Disposition', 'attachment; filename="template-impor-jemaat.xlsx"');
      return c.body(new Uint8Array(buffer));
    })
    .post('/preview', requirePermission('members.import'), async (c) => {
      const form = await c.req.formData().catch(() => null);
      if (!form) {
        throw badRequest('Kirim berkas sebagai form-data dengan field "file".');
      }
      const file = form.get('file');
      if (!(file instanceof File)) {
        throw badRequest('Field "file" wajib berisi berkas Excel.');
      }
      assertImportSize(file.size);
      if (file.size > IMPORT_MAX_BYTES) {
        throw badRequest('Berkas terlalu besar. Maksimal 5 MB.');
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await previewImport(c.get('db'), buffer);
      return c.json(result);
    })
    .post(
      '/confirm',
      requirePermission('members.import'),
      jsonBody(
        z.object({
          rows: z
            .array(
              z.object({
                rowNumber: z.number().int(),
                data: z.record(z.string(), z.unknown()),
                errors: z.array(z.string()),
                duplicateOf: z.string().uuid().nullable(),
                action: z.enum(['skip', 'update']),
              }),
            )
            .max(5000),
          choices: confirmSchema.shape.choices,
        }),
      ),
      async (c) => {
        const actor = currentUser(c);
        const body = c.req.valid('json');
        // Data baris divalidasi ulang di service agar tidak bisa disusupkan.
        const result = await confirmImport(
          c.get('db'),
          { id: actor.user.id },
          body.rows.map((row) => ({
            rowNumber: row.rowNumber,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data: row.data as any,
            errors: row.errors,
            duplicateOf: row.duplicateOf,
            action: row.action,
          })),
          body.choices,
        );
        return c.json(result);
      },
    )
    .get('/export', requirePermission('members.export'), async (c) => {
      const url = new URL(c.req.url);
      const parsed = exportQuerySchema.safeParse({
        status: url.searchParams.get('status') ?? undefined,
        regionId: url.searchParams.get('regionId') ?? undefined,
      });
      if (!parsed.success) {
        throw badRequest('Filter ekspor tidak valid.');
      }
      const actor = currentUser(c);
      const buffer = await exportMembers(c.get('db'), { id: actor.user.id }, parsed.data);
      c.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      c.header('Content-Disposition', 'attachment; filename="data-jemaat.xlsx"');
      return c.body(new Uint8Array(buffer));
    });
}
