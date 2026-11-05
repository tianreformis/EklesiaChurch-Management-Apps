import { z } from 'zod';
import { nameSchema, paginationSchema } from './common.js';

/** Arah transaksi. Nominal selalu integer rupiah positif; arah dari `type`. */
export const TRANSACTION_TYPES = ['in', 'out'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  in: 'Pemasukan',
  out: 'Pengeluaran',
};

export const TRANSACTION_STATUSES = ['aktif', 'void'] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const TRANSACTION_STATUS_LABELS: Record<TransactionStatus, string> = {
  aktif: 'Aktif',
  void: 'Dibatalkan (void)',
};

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} terlalu panjang.`)
    .optional()
    .transform((value) => (value === '' ? undefined : value));

const dateString = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Gunakan format YYYY-MM-DD.');

/** Nominal integer rupiah, tidak boleh negatif atau nol untuk transaksi. */
export const amountSchema = z
  .number({ message: 'Nominal harus berupa angka.' })
  .int('Nominal harus bilangan bulat rupiah.')
  .min(1, 'Nominal harus lebih dari nol.')
  .max(1_000_000_000_000, 'Nominal terlalu besar.');

export const createCashAccountSchema = z.object({
  name: nameSchema,
  openingBalance: z
    .number({ message: 'Saldo awal harus berupa angka.' })
    .int('Saldo awal harus bilangan bulat rupiah.')
    .min(0, 'Saldo awal tidak boleh negatif.')
    .max(1_000_000_000_000, 'Saldo awal terlalu besar.')
    .default(0),
});

export type CreateCashAccountInput = z.infer<typeof createCashAccountSchema>;

export const updateCashAccountSchema = z
  .object({
    name: nameSchema.optional(),
    openingBalance: z
      .number()
      .int('Saldo awal harus bilangan bulat rupiah.')
      .min(0, 'Saldo awal tidak boleh negatif.')
      .optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Tidak ada perubahan yang dikirim.');

export type UpdateCashAccountInput = z.infer<typeof updateCashAccountSchema>;

export const createFinanceCategorySchema = z.object({
  name: nameSchema,
  type: z.enum(TRANSACTION_TYPES),
});

export type CreateFinanceCategoryInput = z.infer<typeof createFinanceCategorySchema>;

export const updateFinanceCategorySchema = z
  .object({
    name: nameSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Tidak ada perubahan yang dikirim.');

export type UpdateFinanceCategoryInput = z.infer<typeof updateFinanceCategorySchema>;

export const createTransactionSchema = z.object({
  accountId: z.string().uuid('Akun kas tidak dikenal.'),
  categoryId: z.string().uuid('Kategori tidak dikenal.'),
  type: z.enum(TRANSACTION_TYPES),
  amount: amountSchema,
  date: dateString,
  description: optionalText(500, 'Keterangan'),
  serviceId: z.string().uuid('Ibadah tidak dikenal.').nullish(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

export const updateTransactionSchema = z
  .object({
    accountId: z.string().uuid('Akun kas tidak dikenal.').optional(),
    categoryId: z.string().uuid('Kategori tidak dikenal.').optional(),
    type: z.enum(TRANSACTION_TYPES).optional(),
    amount: amountSchema.optional(),
    date: dateString.optional(),
    description: optionalText(500, 'Keterangan').nullable(),
    serviceId: z.string().uuid('Ibadah tidak dikenal.').nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Tidak ada perubahan yang dikirim.');

export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;

export const voidTransactionSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, 'Alasan pembatalan minimal 5 karakter.')
    .max(500, 'Alasan terlalu panjang.'),
});

export type VoidTransactionInput = z.infer<typeof voidTransactionSchema>;

export const transactionFilterSchema = paginationSchema.extend({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Gunakan format bulan YYYY-MM.')
    .optional(),
  accountId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  type: z.enum(TRANSACTION_TYPES).optional(),
  status: z.enum(TRANSACTION_STATUSES).optional(),
});

export type TransactionFilter = z.infer<typeof transactionFilterSchema>;

/** Form cepat persembahan Minggu: beberapa pos pemasukan dalam satu ibadah. */
export const sundayOfferingSchema = z.object({
  serviceId: z.string().uuid('Ibadah tidak dikenal.'),
  accountId: z.string().uuid('Akun kas tidak dikenal.'),
  date: dateString,
  countedBy: z.string().trim().min(2, 'Nama penghitung wajib diisi.').max(120),
  verifiedBy: z.string().trim().min(2, 'Nama pemeriksa wajib diisi.').max(120),
  entries: z
    .array(
      z.object({
        categoryId: z.string().uuid('Kategori tidak dikenal.'),
        amount: amountSchema,
      }),
    )
    .min(1, 'Isi minimal satu pos persembahan.')
    .max(20, 'Terlalu banyak pos dalam satu form.'),
});

export type SundayOfferingInput = z.infer<typeof sundayOfferingSchema>;

export const periodParamSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export type PeriodParam = z.infer<typeof periodParamSchema>;

export const reportQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

export type ReportQuery = z.infer<typeof reportQuerySchema>;

/** Kategori bawaan yang dibuat otomatis untuk gereja baru. */
export const DEFAULT_INCOME_CATEGORIES = [
  'Perpuluhan',
  'Persembahan Minggu',
  'Ucapan Syukur',
  'Diakonia',
  'Pembangunan',
  'Misi',
  'Lain-lain',
] as const;

export const DEFAULT_EXPENSE_CATEGORIES = [
  'Operasional',
  'Gaji/Honor',
  'Listrik/Air',
  'Diakonia',
  'Pembangunan',
  'Misi',
  'Lain-lain',
] as const;

export const DEFAULT_CASH_ACCOUNT = 'Kas Utama';
