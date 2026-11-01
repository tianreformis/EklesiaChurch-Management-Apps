import { z } from 'zod';
import { ROLES } from '../permissions.js';
import { emailSchema, nameSchema } from './common.js';

/**
 * Peran yang boleh diundang lewat UI. Admin gereja hanya dibuat oleh pemilik
 * platform saat gereja dibuat, supaya selalu ada penanggung jawab awal.
 */
export const INVITABLE_ROLES = ROLES.filter((role) => role !== 'admin_gereja');

export const inviteUserSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  role: z.enum(INVITABLE_ROLES, 'Pilih peran yang tersedia.'),
});

export const updateUserSchema = z
  .object({
    name: nameSchema.optional(),
    role: z.enum(INVITABLE_ROLES, 'Pilih peran yang tersedia.').optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Tidak ada perubahan yang dikirim.');

export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
