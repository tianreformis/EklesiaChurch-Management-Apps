import {
  bigint,
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { churches } from './churches.js';
import { services } from './schedule.js';

export const transactionTypeEnum = pgEnum('transaction_type', ['in', 'out']);
export const transactionStatusEnum = pgEnum('transaction_status', ['aktif', 'void']);

/** Akun kas gereja. Saldo awal integer rupiah. */
export const cashAccounts = pgTable(
  'cash_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    churchId: uuid('church_id')
      .notNull()
      .references(() => churches.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    openingBalance: bigint('opening_balance', { mode: 'number' }).notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('cash_accounts_church_id_idx').on(table.churchId)],
);

/** Pos pemasukan/pengeluaran, dapat ditambah admin. */
export const financeCategories = pgTable(
  'finance_categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    churchId: uuid('church_id')
      .notNull()
      .references(() => churches.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: transactionTypeEnum('type').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('finance_categories_church_id_idx').on(table.churchId)],
);

/**
 * Transaksi keuangan. TIDAK PERNAH dihapus keras: koreksi lewat status `void`
 * + alasan. Nominal integer rupiah positif; arah ditentukan `type`.
 */
export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    churchId: uuid('church_id')
      .notNull()
      .references(() => churches.id, { onDelete: 'cascade' }),
    accountId: uuid('account_id')
      .notNull()
      .references(() => cashAccounts.id, { onDelete: 'restrict' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => financeCategories.id, { onDelete: 'restrict' }),
    type: transactionTypeEnum('type').notNull(),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    date: date('date').notNull(),
    description: text('description'),
    serviceId: uuid('service_id').references(() => services.id, { onDelete: 'set null' }),
    attachmentFile: text('attachment_file'),
    status: transactionStatusEnum('status').notNull().default('aktif'),
    voidReason: text('void_reason'),
    countedBy: text('counted_by'),
    verifiedBy: text('verified_by'),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('transactions_church_id_idx').on(table.churchId),
    index('transactions_church_date_idx').on(table.churchId, table.date),
    index('transactions_account_idx').on(table.accountId),
  ],
);

/** Bulan yang ditutup: transaksi di bulan terkunci tidak bisa diubah. */
export const periodLocks = pgTable(
  'period_locks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    churchId: uuid('church_id')
      .notNull()
      .references(() => churches.id, { onDelete: 'cascade' }),
    year: integer('year').notNull(),
    month: integer('month').notNull(),
    lockedBy: uuid('locked_by').notNull(),
    lockedAt: timestamp('locked_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('period_locks_church_id_idx').on(table.churchId)],
);

export type CashAccount = typeof cashAccounts.$inferSelect;
export type FinanceCategory = typeof financeCategories.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type PeriodLock = typeof periodLocks.$inferSelect;
