import { and, asc, count, desc, eq, gte, lte, sql } from 'drizzle-orm';
import type {
  CreateCashAccountInput,
  CreateFinanceCategoryInput,
  CreateTransactionInput,
  SundayOfferingInput,
  TransactionFilter,
  UpdateCashAccountInput,
  UpdateFinanceCategoryInput,
  UpdateTransactionInput,
} from '@eklesia/shared';
import {
  DEFAULT_CASH_ACCOUNT,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  paginationMeta,
} from '@eklesia/shared';
import type { Role } from '@eklesia/shared';
import type { TenantDb } from '../../db/tenant.js';
import {
  cashAccounts,
  financeCategories,
  periodLocks,
  services,
  transactions,
  type CashAccount,
  type FinanceCategory,
  type Transaction,
} from '../../db/schema/index.js';
import { conflict, forbidden, notFound } from '../../lib/errors.js';
import { recordAudit } from '../audit/service.js';

export interface FinanceActor {
  id: string;
  role: Role;
}

/** Membuat akun kas dan kategori bawaan bila gereja belum punya sama sekali. */
export async function ensureFinanceDefaults(tenant: TenantDb): Promise<void> {
  const [accountCount] = await tenant.select({ total: count() }).from(cashAccounts);
  if ((accountCount?.total ?? 0) === 0) {
    await tenant
      .insert(cashAccounts)
      .values({ churchId: tenant.churchId, name: DEFAULT_CASH_ACCOUNT, openingBalance: 0 });
  }
  const [categoryCount] = await tenant.select({ total: count() }).from(financeCategories);
  if ((categoryCount?.total ?? 0) === 0) {
    await tenant.insert(financeCategories).values([
      ...DEFAULT_INCOME_CATEGORIES.map((name) => ({
        churchId: tenant.churchId,
        name,
        type: 'in' as const,
      })),
      ...DEFAULT_EXPENSE_CATEGORIES.map((name) => ({
        churchId: tenant.churchId,
        name,
        type: 'out' as const,
      })),
    ]);
  }
}

function serializeAccount(row: CashAccount, balance: number) {
  return {
    ...row,
    balance,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Saldo berjalan satu akun: saldo awal + masuk aktif − keluar aktif. */
export async function accountBalance(tenant: TenantDb, accountId: string, opening: number): Promise<number> {
  const [row] = await tenant
    .select({
      total: sql<number>`coalesce(sum(case when ${transactions.type} = 'in' then ${transactions.amount} else -${transactions.amount} end), 0)`,
    })
    .from(transactions)
    .where(and(eq(transactions.accountId, accountId), eq(transactions.status, 'aktif')));
  return opening + Number(row?.total ?? 0);
}

export async function listAccounts(tenant: TenantDb) {
  await ensureFinanceDefaults(tenant);
  const rows = await tenant.select().from(cashAccounts).orderBy(asc(cashAccounts.name));
  const result = [];
  for (const row of rows) {
    result.push(serializeAccount(row, await accountBalance(tenant, row.id, row.openingBalance)));
  }
  return result;
}

export async function createAccount(tenant: TenantDb, actor: FinanceActor, input: CreateCashAccountInput) {
  const [created] = await tenant
    .insert(cashAccounts)
    .values({ churchId: tenant.churchId, name: input.name, openingBalance: input.openingBalance })
    .returning();
  if (!created) {
    throw conflict('Akun kas gagal dibuat.');
  }
  await recordAudit(tenant, {
    churchId: tenant.churchId,
    userId: actor.id,
    entity: 'cash_account',
    entityId: created.id,
    action: 'cash_account.created',
    after: { name: created.name },
  });
  return serializeAccount(created, created.openingBalance);
}

export async function updateAccount(
  tenant: TenantDb,
  actor: FinanceActor,
  id: string,
  input: UpdateCashAccountInput,
) {
  const [updated] = await tenant
    .update(cashAccounts)
    .set({
      ...(input.name ? { name: input.name } : {}),
      ...(input.openingBalance === undefined ? {} : { openingBalance: input.openingBalance }),
      ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
      updatedAt: new Date(),
    })
    .where(eq(cashAccounts.id, id))
    .returning();
  if (!updated) {
    throw notFound('Akun kas tidak ditemukan.');
  }
  await recordAudit(tenant, {
    churchId: tenant.churchId,
    userId: actor.id,
    entity: 'cash_account',
    entityId: id,
    action: 'cash_account.updated',
    after: { name: updated.name, isActive: updated.isActive },
  });
  return serializeAccount(updated, await accountBalance(tenant, updated.id, updated.openingBalance));
}

function serializeCategory(row: FinanceCategory) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listCategories(tenant: TenantDb) {
  await ensureFinanceDefaults(tenant);
  const rows = await tenant
    .select()
    .from(financeCategories)
    .orderBy(asc(financeCategories.type), asc(financeCategories.name));
  return rows.map(serializeCategory);
}

export async function createCategory(
  tenant: TenantDb,
  actor: FinanceActor,
  input: CreateFinanceCategoryInput,
) {
  const [created] = await tenant
    .insert(financeCategories)
    .values({ churchId: tenant.churchId, name: input.name, type: input.type })
    .returning();
  if (!created) {
    throw conflict('Kategori gagal dibuat.');
  }
  await recordAudit(tenant, {
    churchId: tenant.churchId,
    userId: actor.id,
    entity: 'finance_category',
    entityId: created.id,
    action: 'finance_category.created',
    after: { name: created.name, type: created.type },
  });
  return serializeCategory(created);
}

export async function updateCategory(
  tenant: TenantDb,
  actor: FinanceActor,
  id: string,
  input: UpdateFinanceCategoryInput,
) {
  const [updated] = await tenant
    .update(financeCategories)
    .set({
      ...(input.name ? { name: input.name } : {}),
      ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
      updatedAt: new Date(),
    })
    .where(eq(financeCategories.id, id))
    .returning();
  if (!updated) {
    throw notFound('Kategori tidak ditemukan.');
  }
  await recordAudit(tenant, {
    churchId: tenant.churchId,
    userId: actor.id,
    entity: 'finance_category',
    entityId: id,
    action: 'finance_category.updated',
    after: { name: updated.name, isActive: updated.isActive },
  });
  return serializeCategory(updated);
}

/** Periode terkunci menolak buat/ubah/void (aturan bisnis 4). */
export async function assertPeriodOpen(tenant: TenantDb, date: string): Promise<void> {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const [lock] = await tenant
    .select({ id: periodLocks.id })
    .from(periodLocks)
    .where(and(eq(periodLocks.year, year), eq(periodLocks.month, month)))
    .limit(1);
  if (lock) {
    throw forbidden(
      `Periode ${String(month).padStart(2, '0')}/${year} sudah ditutup. Minta admin membuka kembali bila perlu koreksi.`,
    );
  }
}

async function assertAccountAndCategory(
  tenant: TenantDb,
  input: { accountId: string; categoryId: string; type: 'in' | 'out' },
): Promise<void> {
  const [account] = await tenant
    .select()
    .from(cashAccounts)
    .where(eq(cashAccounts.id, input.accountId))
    .limit(1);
  if (!account) {
    throw notFound('Akun kas tidak ditemukan.');
  }
  if (!account.isActive) {
    throw conflict('Akun kas ini sudah dinonaktifkan.');
  }
  const [category] = await tenant
    .select()
    .from(financeCategories)
    .where(eq(financeCategories.id, input.categoryId))
    .limit(1);
  if (!category) {
    throw notFound('Kategori tidak ditemukan.');
  }
  if (!category.isActive) {
    throw conflict('Kategori ini sudah dinonaktifkan.');
  }
  if (category.type !== input.type) {
    throw conflict(
      input.type === 'in'
        ? 'Kategori yang dipilih bukan kategori pemasukan.'
        : 'Kategori yang dipilih bukan kategori pengeluaran.',
    );
  }
}

async function assertServiceExists(tenant: TenantDb, serviceId: string | null | undefined): Promise<void> {
  if (!serviceId) {
    return;
  }
  const [service] = await tenant.select({ id: services.id }).from(services).where(eq(services.id, serviceId)).limit(1);
  if (!service) {
    throw notFound('Ibadah tidak ditemukan.');
  }
}

function serializeTransaction(row: Transaction & { accountName?: string; categoryName?: string }) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createTransaction(
  tenant: TenantDb,
  actor: FinanceActor,
  input: CreateTransactionInput,
) {
  await assertPeriodOpen(tenant, input.date);
  await assertAccountAndCategory(tenant, input);
  await assertServiceExists(tenant, input.serviceId);

  const [created] = await tenant
    .insert(transactions)
    .values({
      churchId: tenant.churchId,
      accountId: input.accountId,
      categoryId: input.categoryId,
      type: input.type,
      amount: input.amount,
      date: input.date,
      description: input.description ?? null,
      serviceId: input.serviceId ?? null,
      createdBy: actor.id,
    })
    .returning();
  if (!created) {
    throw conflict('Transaksi gagal dibuat.');
  }
  await recordAudit(tenant, {
    churchId: tenant.churchId,
    userId: actor.id,
    entity: 'transaction',
    entityId: created.id,
    action: 'transaction.created',
    after: { type: created.type, date: created.date, accountId: created.accountId },
  });
  return serializeTransaction(created);
}

export async function updateTransaction(
  tenant: TenantDb,
  actor: FinanceActor,
  id: string,
  input: UpdateTransactionInput,
) {
  const [existing] = await tenant.select().from(transactions).where(eq(transactions.id, id)).limit(1);
  if (!existing) {
    throw notFound('Transaksi tidak ditemukan.');
  }
  if (existing.status === 'void') {
    throw conflict('Transaksi yang sudah dibatalkan tidak dapat diubah.');
  }
  await assertPeriodOpen(tenant, existing.date);
  if (input.date && input.date !== existing.date) {
    await assertPeriodOpen(tenant, input.date);
  }
  const merged = {
    accountId: input.accountId ?? existing.accountId,
    categoryId: input.categoryId ?? existing.categoryId,
    type: input.type ?? existing.type,
  };
  await assertAccountAndCategory(tenant, merged);
  await assertServiceExists(tenant, input.serviceId === undefined ? existing.serviceId : input.serviceId);

  const [updated] = await tenant
    .update(transactions)
    .set({
      ...(input.accountId ? { accountId: input.accountId } : {}),
      ...(input.categoryId ? { categoryId: input.categoryId } : {}),
      ...(input.type ? { type: input.type } : {}),
      ...(input.amount === undefined ? {} : { amount: input.amount }),
      ...(input.date ? { date: input.date } : {}),
      ...(input.description === undefined ? {} : { description: input.description ?? null }),
      ...(input.serviceId === undefined ? {} : { serviceId: input.serviceId }),
      updatedAt: new Date(),
    })
    .where(eq(transactions.id, id))
    .returning();
  if (!updated) {
    throw notFound('Transaksi tidak ditemukan.');
  }
  await recordAudit(tenant, {
    churchId: tenant.churchId,
    userId: actor.id,
    entity: 'transaction',
    entityId: id,
    action: 'transaction.updated',
    before: { type: existing.type, date: existing.date },
    after: { type: updated.type, date: updated.date },
  });
  return serializeTransaction(updated);
}

/** Void, bukan hapus: transaksi tetap tersimpan dan tercatat di audit. */
export async function voidTransaction(
  tenant: TenantDb,
  actor: FinanceActor,
  id: string,
  reason: string,
) {
  const [existing] = await tenant.select().from(transactions).where(eq(transactions.id, id)).limit(1);
  if (!existing) {
    throw notFound('Transaksi tidak ditemukan.');
  }
  if (existing.status === 'void') {
    throw conflict('Transaksi ini sudah dibatalkan sebelumnya.');
  }
  await assertPeriodOpen(tenant, existing.date);
  const [updated] = await tenant
    .update(transactions)
    .set({ status: 'void', voidReason: reason, updatedAt: new Date() })
    .where(eq(transactions.id, id))
    .returning();
  await recordAudit(tenant, {
    churchId: tenant.churchId,
    userId: actor.id,
    entity: 'transaction',
    entityId: id,
    action: 'transaction.voided',
    before: { status: existing.status },
    after: { status: 'void', reason },
  });
  return serializeTransaction(updated!);
}

export async function listTransactions(tenant: TenantDb, filter: TransactionFilter) {
  const offset = (filter.page - 1) * filter.perPage;
  const conditions = [];
  if (filter.month) {
    const [year, mon] = filter.month.split('-').map(Number) as [number, number];
    const lastDay = new Date(Date.UTC(year, mon, 0)).getUTCDate();
    conditions.push(gte(transactions.date, `${filter.month}-01`));
    conditions.push(lte(transactions.date, `${filter.month}-${String(lastDay).padStart(2, '0')}`));
  }
  if (filter.accountId) {
    conditions.push(eq(transactions.accountId, filter.accountId));
  }
  if (filter.categoryId) {
    conditions.push(eq(transactions.categoryId, filter.categoryId));
  }
  if (filter.type) {
    conditions.push(eq(transactions.type, filter.type));
  }
  if (filter.status) {
    conditions.push(eq(transactions.status, filter.status));
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  let rowsQuery = tenant
    .select({
      id: transactions.id,
      churchId: transactions.churchId,
      accountId: transactions.accountId,
      categoryId: transactions.categoryId,
      type: transactions.type,
      amount: transactions.amount,
      date: transactions.date,
      description: transactions.description,
      serviceId: transactions.serviceId,
      attachmentFile: transactions.attachmentFile,
      status: transactions.status,
      voidReason: transactions.voidReason,
      countedBy: transactions.countedBy,
      verifiedBy: transactions.verifiedBy,
      createdBy: transactions.createdBy,
      createdAt: transactions.createdAt,
      updatedAt: transactions.updatedAt,
      accountName: cashAccounts.name,
      categoryName: financeCategories.name,
    })
    .from(transactions)
    .innerJoin(cashAccounts, eq(transactions.accountId, cashAccounts.id))
    .innerJoin(financeCategories, eq(transactions.categoryId, financeCategories.id))
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .limit(filter.perPage)
    .offset(offset);
  if (whereClause) {
    rowsQuery = rowsQuery.where(whereClause) as typeof rowsQuery;
  }

  let countQuery = tenant.select({ total: count() }).from(transactions);
  if (whereClause) {
    countQuery = countQuery.where(whereClause) as typeof countQuery;
  }

  const [rows, countRows] = await Promise.all([rowsQuery, countQuery]);
  const total = countRows[0]?.total ?? 0;
  return {
    items: rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    meta: paginationMeta(filter.page, filter.perPage, total),
  };
}

export async function getTransaction(tenant: TenantDb, id: string) {
  const [row] = await tenant.select().from(transactions).where(eq(transactions.id, id)).limit(1);
  if (!row) {
    throw notFound('Transaksi tidak ditemukan.');
  }
  return serializeTransaction(row);
}

/** Mencatat nama berkas lampiran yang sudah disimpan lib/attachments. */
export async function setTransactionAttachment(
  tenant: TenantDb,
  actor: FinanceActor,
  id: string,
  filename: string,
) {
  const [existing] = await tenant.select().from(transactions).where(eq(transactions.id, id)).limit(1);
  if (!existing) {
    throw notFound('Transaksi tidak ditemukan.');
  }
  if (existing.status === 'void') {
    throw conflict('Transaksi yang sudah dibatalkan tidak dapat diubah.');
  }
  const [updated] = await tenant
    .update(transactions)
    .set({ attachmentFile: filename, updatedAt: new Date() })
    .where(eq(transactions.id, id))
    .returning();
  await recordAudit(tenant, {
    churchId: tenant.churchId,
    userId: actor.id,
    entity: 'transaction',
    entityId: id,
    action: 'transaction.attachment_added',
  });
  return serializeTransaction(updated!);
}

/** Memastikan lampiran ini memang milik transaksi di gereja ini (isolasi tenant). */
export async function findAttachmentOwner(tenant: TenantDb, filename: string) {
  const [row] = await tenant
    .select({ id: transactions.id })
    .from(transactions)
    .where(eq(transactions.attachmentFile, filename))
    .limit(1);
  return row ?? null;
}

/**
 * Form cepat persembahan Minggu: satu transaksi pemasukan per pos, lengkap
 * dengan nama penghitung dan pemeriksa (dua orang berbeda peran catat).
 */
export async function createSundayOffering(
  tenant: TenantDb,
  actor: FinanceActor,
  input: SundayOfferingInput,
) {
  await assertPeriodOpen(tenant, input.date);
  await assertServiceExists(tenant, input.serviceId);
  const [account] = await tenant
    .select()
    .from(cashAccounts)
    .where(eq(cashAccounts.id, input.accountId))
    .limit(1);
  if (!account) {
    throw notFound('Akun kas tidak ditemukan.');
  }

  const created: Transaction[] = [];
  let total = 0;
  for (const entry of input.entries) {
    await assertAccountAndCategory(tenant, {
      accountId: input.accountId,
      categoryId: entry.categoryId,
      type: 'in',
    });
    const [row] = await tenant
      .insert(transactions)
      .values({
        churchId: tenant.churchId,
        accountId: input.accountId,
        categoryId: entry.categoryId,
        type: 'in',
        amount: entry.amount,
        date: input.date,
        description: 'Persembahan Minggu',
        serviceId: input.serviceId,
        countedBy: input.countedBy,
        verifiedBy: input.verifiedBy,
        createdBy: actor.id,
      })
      .returning();
    if (row) {
      created.push(row);
      total += entry.amount;
    }
  }
  await recordAudit(tenant, {
    churchId: tenant.churchId,
    userId: actor.id,
    entity: 'transaction',
    entityId: created[0]?.id ?? null,
    action: 'transaction.offering_created',
    after: { entries: created.length, serviceId: input.serviceId },
  });
  return { items: created.map((row) => serializeTransaction(row)), total };
}

export async function listPeriodLocks(tenant: TenantDb) {
  const rows = await tenant
    .select()
    .from(periodLocks)
    .orderBy(desc(periodLocks.year), desc(periodLocks.month));
  return rows.map((row) => ({ ...row, lockedAt: row.lockedAt.toISOString() }));
}

export async function lockPeriod(tenant: TenantDb, actor: FinanceActor, year: number, month: number) {
  const [existing] = await tenant
    .select({ id: periodLocks.id })
    .from(periodLocks)
    .where(and(eq(periodLocks.year, year), eq(periodLocks.month, month)))
    .limit(1);
  if (existing) {
    throw conflict('Periode ini sudah ditutup.');
  }
  const [created] = await tenant
    .insert(periodLocks)
    .values({ churchId: tenant.churchId, year, month, lockedBy: actor.id })
    .returning();
  await recordAudit(tenant, {
    churchId: tenant.churchId,
    userId: actor.id,
    entity: 'period_lock',
    entityId: created?.id ?? null,
    action: 'period.locked',
    after: { year, month },
  });
  return { ...created, lockedAt: created!.lockedAt.toISOString() };
}

/** Membuka periode hanya boleh admin gereja (aturan penutupan periode). */
export async function unlockPeriod(tenant: TenantDb, actor: FinanceActor, year: number, month: number) {
  if (actor.role !== 'admin_gereja') {
    throw forbidden('Hanya admin gereja yang dapat membuka kembali periode yang ditutup.');
  }
  const [existing] = await tenant
    .select({ id: periodLocks.id })
    .from(periodLocks)
    .where(and(eq(periodLocks.year, year), eq(periodLocks.month, month)))
    .limit(1);
  if (!existing) {
    throw notFound('Periode ini belum ditutup.');
  }
  await tenant.delete(periodLocks).where(eq(periodLocks.id, existing.id));
  await recordAudit(tenant, {
    churchId: tenant.churchId,
    userId: actor.id,
    entity: 'period_lock',
    entityId: existing.id,
    action: 'period.unlocked',
    before: { year, month },
  });
  return { ok: true as const };
}
