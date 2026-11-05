import { Hono } from 'hono';
import { z } from 'zod';
import {
  createCashAccountSchema,
  createFinanceCategorySchema,
  createTransactionSchema,
  idParamSchema,
  periodParamSchema,
  reportQuerySchema,
  sundayOfferingSchema,
  transactionFilterSchema,
  updateCashAccountSchema,
  updateFinanceCategorySchema,
  updateTransactionSchema,
  voidTransactionSchema,
} from '@eklesia/shared';
import type { Database } from '../db/client.js';
import type { AppConfig } from '../lib/env.js';
import type { Mailer } from '../lib/mailer.js';
import type { Logger } from 'pino';
import { readAttachment, saveAttachment } from '../lib/attachments.js';
import { badRequest, notFound } from '../lib/errors.js';
import { currentUser, requirePermission } from '../middleware/permission.js';
import { createTenantMiddleware } from '../middleware/tenant.js';
import { jsonBody, pathParams, queryParams } from '../middleware/validate.js';
import type { AppEnv } from '../types.js';
import {
  createAccount,
  createCategory,
  createSundayOffering,
  createTransaction,
  findAttachmentOwner,
  getTransaction,
  listAccounts,
  listCategories,
  listPeriodLocks,
  listTransactions,
  lockPeriod,
  setTransactionAttachment,
  unlockPeriod,
  updateAccount,
  updateCategory,
  updateTransaction,
  voidTransaction,
} from '../modules/finance/service.js';
import {
  buildMonthlyReportPdf,
  buildReportExcel,
  monthlyReport,
  yearlyReport,
} from '../modules/finance/reports.js';

export interface FinanceRouteDependencies {
  db: Database;
  systemDb: Database;
  env: AppConfig;
  mailer: Mailer;
  logger: Logger;
}

const filenameParam = z.object({
  filename: z.string().min(1).max(120),
});

export function createFinanceRoutes(deps: FinanceRouteDependencies) {
  const tenant = createTenantMiddleware({ db: deps.db });
  const actor = (c: Parameters<typeof currentUser>[0]) => {
    const auth = currentUser(c);
    return { id: auth.user.id, role: auth.user.role };
  };

  return new Hono<AppEnv>()
    .use('*', tenant)
    // Akun kas & kategori.
    .get('/accounts', requirePermission('finance.read'), async (c) => {
      return c.json({ items: await listAccounts(c.get('db')) });
    })
    .post('/accounts', requirePermission('finance.write'), jsonBody(createCashAccountSchema), async (c) => {
      return c.json(await createAccount(c.get('db'), actor(c), c.req.valid('json')), 201);
    })
    .patch(
      '/accounts/:id',
      requirePermission('finance.write'),
      pathParams(idParamSchema),
      jsonBody(updateCashAccountSchema),
      async (c) => {
        return c.json(await updateAccount(c.get('db'), actor(c), c.req.param('id'), c.req.valid('json')));
      },
    )
    .get('/categories', requirePermission('finance.read'), async (c) => {
      return c.json({ items: await listCategories(c.get('db')) });
    })
    .post('/categories', requirePermission('finance.write'), jsonBody(createFinanceCategorySchema), async (c) => {
      return c.json(await createCategory(c.get('db'), actor(c), c.req.valid('json')), 201);
    })
    .patch(
      '/categories/:id',
      requirePermission('finance.write'),
      pathParams(idParamSchema),
      jsonBody(updateFinanceCategorySchema),
      async (c) => {
        return c.json(await updateCategory(c.get('db'), actor(c), c.req.param('id'), c.req.valid('json')));
      },
    )
    // Transaksi.
    .get('/transactions', requirePermission('finance.read'), queryParams(transactionFilterSchema), async (c) => {
      return c.json(await listTransactions(c.get('db'), c.req.valid('query')));
    })
    .post('/transactions', requirePermission('finance.write'), jsonBody(createTransactionSchema), async (c) => {
      return c.json(await createTransaction(c.get('db'), actor(c), c.req.valid('json')), 201);
    })
    .get('/transactions/:id', requirePermission('finance.read'), pathParams(idParamSchema), async (c) => {
      return c.json(await getTransaction(c.get('db'), c.req.param('id')));
    })
    .patch(
      '/transactions/:id',
      requirePermission('finance.write'),
      pathParams(idParamSchema),
      jsonBody(updateTransactionSchema),
      async (c) => {
        return c.json(await updateTransaction(c.get('db'), actor(c), c.req.param('id'), c.req.valid('json')));
      },
    )
    .post(
      '/transactions/:id/void',
      requirePermission('finance.void'),
      pathParams(idParamSchema),
      jsonBody(voidTransactionSchema),
      async (c) => {
        return c.json(await voidTransaction(c.get('db'), actor(c), c.req.param('id'), c.req.valid('json').reason));
      },
    )
    // Lampiran bukti (volume, nama acak, tipe isi diperiksa).
    .post('/transactions/:id/attachment', requirePermission('finance.write'), pathParams(idParamSchema), async (c) => {
      const form = await c.req.formData().catch(() => null);
      if (!form) {
        throw badRequest('Kirim berkas sebagai form-data dengan field "file".');
      }
      const file = form.get('file');
      if (!(file instanceof File)) {
        throw badRequest('Field "file" wajib berisi berkas gambar/PDF.');
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const filename = await saveAttachment(deps.env.ATTACHMENT_DIR, buffer);
      return c.json(await setTransactionAttachment(c.get('db'), actor(c), c.req.param('id'), filename));
    })
    .get('/attachments/:filename', requirePermission('finance.read'), pathParams(filenameParam), async (c) => {
      const filename = c.req.param('filename');
      // Isolasi tenant: berkas hanya disajikan bila ada transaksi gereja ini yang merujuknya.
      const owner = await findAttachmentOwner(c.get('db'), filename);
      if (!owner) {
        throw notFound('Lampiran tidak ditemukan.');
      }
      const file = await readAttachment(deps.env.ATTACHMENT_DIR, filename);
      if (!file) {
        throw notFound('Lampiran tidak ditemukan.');
      }
      c.header('Content-Type', file.contentType);
      c.header('Content-Disposition', `inline; filename="${filename}"`);
      return c.body(new Uint8Array(file.buffer));
    })
    // Persembahan Minggu (form cepat).
    .post('/offerings', requirePermission('finance.write'), jsonBody(sundayOfferingSchema), async (c) => {
      return c.json(await createSundayOffering(c.get('db'), actor(c), c.req.valid('json')), 201);
    })
    // Penutupan periode.
    .get('/period-locks', requirePermission('finance.read'), async (c) => {
      return c.json({ items: await listPeriodLocks(c.get('db')) });
    })
    .post('/period-locks', requirePermission('finance.write'), jsonBody(periodParamSchema), async (c) => {
      const { year, month } = c.req.valid('json');
      return c.json(await lockPeriod(c.get('db'), actor(c), year, month), 201);
    })
    .delete('/period-locks/:year/:month', requirePermission('finance.write'), async (c) => {
      const parsed = periodParamSchema.safeParse({
        year: c.req.param('year'),
        month: c.req.param('month'),
      });
      if (!parsed.success) {
        throw badRequest('Periode tidak valid.');
      }
      return c.json(await unlockPeriod(c.get('db'), actor(c), parsed.data.year, parsed.data.month));
    })
    // Laporan (dihitung di server).
    .get('/reports/monthly', requirePermission('finance.read'), queryParams(reportQuerySchema), async (c) => {
      const query = c.req.valid('query');
      if (!query.month) {
        throw badRequest('Parameter bulan wajib diisi untuk laporan bulanan.');
      }
      return c.json(await monthlyReport(c.get('db'), query.year, query.month));
    })
    .get('/reports/yearly', requirePermission('finance.read'), queryParams(reportQuerySchema), async (c) => {
      const query = c.req.valid('query');
      return c.json(await yearlyReport(c.get('db'), query.year));
    })
    .get('/reports/monthly.pdf', requirePermission('finance.report'), queryParams(reportQuerySchema), async (c) => {
      const query = c.req.valid('query');
      if (!query.month) {
        throw badRequest('Parameter bulan wajib diisi untuk laporan bulanan.');
      }
      const auth = currentUser(c);
      const buffer = await buildMonthlyReportPdf(c.get('db'), auth.church.name, query.year, query.month);
      c.header('Content-Type', 'application/pdf');
      c.header(
        'Content-Disposition',
        `attachment; filename="laporan-${query.year}-${String(query.month).padStart(2, '0')}.pdf"`,
      );
      return c.body(new Uint8Array(buffer));
    })
    .get('/reports/export.xlsx', requirePermission('finance.report'), queryParams(reportQuerySchema), async (c) => {
      const query = c.req.valid('query');
      const buffer = await buildReportExcel(c.get('db'), actor(c), query.year, query.month);
      c.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      c.header('Content-Disposition', `attachment; filename="laporan-${query.year}.xlsx"`);
      return c.body(new Uint8Array(buffer));
    });
}
