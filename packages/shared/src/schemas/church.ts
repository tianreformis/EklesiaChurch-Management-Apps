import { z } from 'zod';
import { emailSchema, nameSchema, phoneSchema } from './common.js';

export const updateChurchSchema = z.object({
  name: nameSchema,
  address: z
    .string()
    .trim()
    .max(300, 'Alamat terlalu panjang.')
    .optional()
    .transform((value) => (value === '' ? undefined : value)),
  phone: phoneSchema,
  timezone: z.string().trim().min(1).max(60).default('Asia/Jakarta'),
});

export const slugSchema = z
  .string()
  .trim()
  .min(3, 'Slug minimal 3 karakter.')
  .max(60, 'Slug terlalu panjang.')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug hanya boleh huruf kecil, angka, dan tanda hubung.');

export const createChurchSchema = z.object({
  name: nameSchema,
  slug: slugSchema,
  address: z.string().trim().max(300).optional(),
  phone: phoneSchema,
  adminName: nameSchema,
  adminEmail: emailSchema,
});

export const updateChurchStatusSchema = z.object({
  status: z.enum(['active', 'suspended']),
  plan: z.enum(['free', 'basic', 'pro']).optional(),
});

export type UpdateChurchInput = z.infer<typeof updateChurchSchema>;
export type CreateChurchInput = z.infer<typeof createChurchSchema>;
export type UpdateChurchStatusInput = z.infer<typeof updateChurchStatusSchema>;
