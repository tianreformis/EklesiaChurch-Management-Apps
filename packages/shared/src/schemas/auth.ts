import { z } from 'zod';
import { emailSchema, passwordSchema } from './common.js';

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password wajib diisi.'),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(10, 'Tautan tidak valid.'),
  password: passwordSchema,
});

export const acceptInvitationSchema = z.object({
  token: z.string().trim().min(10, 'Tautan undangan tidak valid.'),
  password: passwordSchema,
  name: z.string().trim().min(2, 'Nama minimal 2 karakter.').max(120).optional(),
});

export const tokenParamSchema = z.object({
  token: z.string().trim().min(10, 'Tautan tidak valid.'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
