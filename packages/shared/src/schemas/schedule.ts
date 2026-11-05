import { z } from 'zod';
import { nameSchema } from './common.js';

/** Status penugasan pelayan. */
export const ASSIGNMENT_STATUSES = ['menunggu', 'dikonfirmasi', 'ditolak'] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  menunggu: 'Menunggu konfirmasi',
  dikonfirmasi: 'Dikonfirmasi',
  ditolak: 'Ditolak',
};

/** Alur tukar jadwal: pengganti dulu, lalu koordinator. */
export const SWAP_STATUSES = [
  'menunggu_pengganti',
  'menunggu_koordinator',
  'disetujui',
  'ditolak',
  'dibatalkan',
] as const;
export type SwapStatus = (typeof SWAP_STATUSES)[number];

export const SWAP_STATUS_LABELS: Record<SwapStatus, string> = {
  menunggu_pengganti: 'Menunggu jawaban pengganti',
  menunggu_koordinator: 'Menunggu persetujuan koordinator',
  disetujui: 'Disetujui',
  ditolak: 'Ditolak',
  dibatalkan: 'Dibatalkan',
};

export const SERVICE_STATUSES = ['terjadwal', 'selesai', 'dibatalkan'] as const;
export type ServiceStatus = (typeof SERVICE_STATUSES)[number];

export const SERVICE_STATUS_LABELS: Record<ServiceStatus, string> = {
  terjadwal: 'Terjadwal',
  selesai: 'Selesai',
  dibatalkan: 'Dibatalkan',
};

export const REMINDER_CHANNELS = ['whatsapp', 'email'] as const;
export type ReminderChannel = (typeof REMINDER_CHANNELS)[number];

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

const timeString = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Gunakan format jam HH:MM.');

export const createServiceRoleSchema = z.object({
  name: nameSchema,
  groupId: z.string().uuid('Komisi/tim tidak dikenal.').nullish(),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

export type CreateServiceRoleInput = z.infer<typeof createServiceRoleSchema>;

export const updateServiceRoleSchema = z
  .object({
    name: nameSchema.optional(),
    groupId: z.string().uuid('Komisi/tim tidak dikenal.').nullable().optional(),
    sortOrder: z.coerce.number().int().min(0).max(999).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Tidak ada perubahan yang dikirim.');

export type UpdateServiceRoleInput = z.infer<typeof updateServiceRoleSchema>;

export const createServiceSchema = z.object({
  title: nameSchema,
  date: dateString,
  startTime: timeString,
  endTime: timeString.optional(),
  location: optionalText(200, 'Lokasi'),
  theme: optionalText(300, 'Tema'),
  preacher: optionalText(120, 'Pengkhotbah'),
  notes: optionalText(1000, 'Catatan'),
  /** Membuat ibadah mingguan berulang sebanyak ini (termasuk tanggal awal). */
  recurrenceWeeks: z.coerce.number().int().min(1).max(52).default(1),
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>;

export const updateServiceSchema = z
  .object({
    title: nameSchema.optional(),
    date: dateString.optional(),
    startTime: timeString.optional(),
    endTime: timeString.nullable().optional(),
    location: optionalText(200, 'Lokasi').nullable(),
    theme: optionalText(300, 'Tema').nullable(),
    preacher: optionalText(120, 'Pengkhotbah').nullable(),
    notes: optionalText(1000, 'Catatan').nullable(),
    status: z.enum(SERVICE_STATUSES).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Tidak ada perubahan yang dikirim.');

export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;

/** Filter daftar ibadah: bulan `YYYY-MM` atau rentang tanggal. */
export const serviceFilterSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Gunakan format bulan YYYY-MM.')
    .optional(),
  from: dateString.optional(),
  to: dateString.optional(),
});

export type ServiceFilter = z.infer<typeof serviceFilterSchema>;

export const createAssignmentSchema = z.object({
  serviceId: z.string().uuid('Ibadah tidak dikenal.'),
  serviceRoleId: z.string().uuid('Peran pelayanan tidak dikenal.'),
  memberId: z.string().uuid('Anggota tidak dikenal.'),
  notes: optionalText(500, 'Catatan'),
});

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;

export const respondAssignmentSchema = z.object({
  status: z.enum(['dikonfirmasi', 'ditolak']),
});

export type RespondAssignmentInput = z.infer<typeof respondAssignmentSchema>;

export const createSwapRequestSchema = z.object({
  assignmentId: z.string().uuid('Penugasan tidak dikenal.'),
  proposedMemberId: z.string().uuid('Pengganti tidak dikenal.'),
  reason: optionalText(500, 'Alasan'),
});

export type CreateSwapRequestInput = z.infer<typeof createSwapRequestSchema>;

export const respondSwapSchema = z.object({
  accept: z.boolean(),
});

export type RespondSwapInput = z.infer<typeof respondSwapSchema>;

export const updateReminderTemplateSchema = z.object({
  body: z
    .string()
    .trim()
    .min(10, 'Isi template minimal 10 karakter.')
    .max(2000, 'Isi template terlalu panjang.'),
});

export type UpdateReminderTemplateInput = z.infer<typeof updateReminderTemplateSchema>;

export const remindServiceSchema = z.object({
  sendEmail: z.boolean().default(false),
});

export type RemindServiceInput = z.infer<typeof remindServiceSchema>;

/** Template bawaan; placeholder: {nama} {peran} {ibadah} {tanggal} {jam} {lokasi}. */
export const DEFAULT_WHATSAPP_TEMPLATE =
  'Shalom {nama}, mengingatkan tugas pelayanan sebagai {peran} pada {ibadah}, {tanggal} pukul {jam} di {lokasi}. Mohon konfirmasi kehadiran. Tuhan memberkati.';

export const DEFAULT_EMAIL_TEMPLATE =
  'Shalom {nama},\n\nMengingatkan tugas pelayanan sebagai {peran} pada {ibadah}, {tanggal} pukul {jam} di {lokasi}.\n\nMohon konfirmasi kehadiran melalui aplikasi. Tuhan memberkati.';
