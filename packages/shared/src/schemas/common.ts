import { z } from 'zod';

/** Pesan kesalahan dalam Bahasa Indonesia, dipakai form dan API. */
export const EMAIL_REQUIRED_MESSAGE = 'Email wajib diisi.';
export const EMAIL_INVALID_MESSAGE = 'Format email belum benar.';
export const PASSWORD_MIN_MESSAGE = 'Password minimal 8 karakter.';
export const PASSWORD_REQUIRED_MESSAGE = 'Password wajib diisi.';

export const emailSchema = z
  .string()
  .trim()
  .min(1, EMAIL_REQUIRED_MESSAGE)
  .max(200, 'Email terlalu panjang.')
  .email(EMAIL_INVALID_MESSAGE)
  .transform((value) => value.toLowerCase());

/**
 * Password minimal 8 karakter dengan huruf dan angka. Aturan ini dipakai di
 * server dan ditampilkan juga pada form agar tidak ada kejutan.
 */
export const passwordSchema = z
  .string()
  .min(8, PASSWORD_MIN_MESSAGE)
  .max(200, 'Password terlalu panjang.')
  .regex(/[A-Za-z]/, 'Password harus memuat huruf.')
  .regex(/[0-9]/, 'Password harus memuat angka.');

export const nameSchema = z
  .string()
  .trim()
  .min(2, 'Nama minimal 2 karakter.')
  .max(120, 'Nama terlalu panjang.');

export const phoneSchema = z
  .string()
  .trim()
  .max(30, 'Nomor telepon terlalu panjang.')
  .regex(/^[0-9+()\-\s]*$/, 'Nomor telepon hanya boleh berisi angka dan tanda + ( ) -')
  .optional()
  .transform((value) => (value === '' ? undefined : value));

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

export const uuidSchema = z.string().uuid('Alamat data tidak valid.');
export const idParamSchema = z.object({ id: uuidSchema });

export type Pagination = z.infer<typeof paginationSchema>;

export function paginationMeta(page: number, perPage: number, total: number) {
  return {
    page,
    perPage,
    total,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}
