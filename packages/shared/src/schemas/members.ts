import { z } from 'zod';
import { emailSchema, nameSchema, paginationSchema, phoneSchema } from './common.js';

/**
 * Nilai status anggota. Label Indonesia disesuaikan agar umum dipakai banyak
 * denominasi gereja.
 */
export const MEMBER_STATUSES = ['aktif', 'pindah', 'meninggal', 'tidak_aktif'] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export const MEMBER_STATUS_LABELS: Record<MemberStatus, string> = {
  aktif: 'Aktif',
  pindah: 'Pindah gereja',
  meninggal: 'Meninggal',
  tidak_aktif: 'Tidak aktif',
};

export const GENDERS = ['laki_laki', 'perempuan'] as const;
export type Gender = (typeof GENDERS)[number];

export const GENDER_LABELS: Record<Gender, string> = {
  laki_laki: 'Laki-laki',
  perempuan: 'Perempuan',
};

/** Jenis golongan/komisi. */
export const GROUP_TYPES = ['komisi', 'tim_pelayanan'] as const;
export type GroupType = (typeof GROUP_TYPES)[number];

export const GROUP_TYPE_LABELS: Record<GroupType, string> = {
  komisi: 'Komisi',
  tim_pelayanan: 'Tim pelayanan',
};

const optionalDate = z
  .string()
  .trim()
  .max(10, 'Format tanggal belum benar.')
  .regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Gunakan format YYYY-MM-DD.')
  .optional()
  .transform((value) => (value === '' ? undefined : value));

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} terlalu panjang.`)
    .optional()
    .transform((value) => (value === '' ? undefined : value));

export const createMemberSchema = z.object({
  fullName: nameSchema,
  nickname: optionalText(60, 'Nama panggilan'),
  gender: z.enum(GENDERS, 'Pilih jenis kelamin.').optional(),
  birthDate: optionalDate,
  phone: phoneSchema,
  email: emailSchema.nullish().transform((value) => value ?? undefined),
  address: optionalText(500, 'Alamat'),
  status: z.enum(MEMBER_STATUSES).default('aktif'),
  familyId: z.string().uuid('Keluarga tidak dikenal.').nullish(),
  regionId: z.string().uuid('Wilayah tidak dikenal.').nullish(),
  baptismDate: optionalDate,
  sidiDate: optionalDate,
  marriageDate: optionalDate,
  spouseMemberId: z.string().uuid('Pasangan tidak dikenal.').nullish(),
  notes: optionalText(1000, 'Catatan'),
});

export type CreateMemberInput = z.infer<typeof createMemberSchema>;

export const updateMemberSchema = createMemberSchema
  .omit({ status: true })
  .partial()
  .extend({ status: z.enum(MEMBER_STATUSES).optional() })
  .refine((value) => Object.keys(value).length > 0, 'Tidak ada perubahan yang dikirim.');

export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

export const memberFilterSchema = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  status: z.enum(MEMBER_STATUSES).optional(),
  regionId: z.string().uuid().optional(),
  groupId: z.string().uuid().optional(),
  birthMonth: z.coerce.number().int().min(1).max(12).optional(),
});

export type MemberFilter = z.infer<typeof memberFilterSchema>;

export const createFamilySchema = z.object({
  name: nameSchema,
  headMemberId: z.string().uuid('Ketua keluarga tidak dikenal.').nullish(),
});

export type CreateFamilyInput = z.infer<typeof createFamilySchema>;

export const updateFamilySchema = z
  .object({
    name: nameSchema.optional(),
    headMemberId: z.string().uuid('Ketua keluarga tidak dikenal.').nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Tidak ada perubahan yang dikirim.');

export type UpdateFamilyInput = z.infer<typeof updateFamilySchema>;

export const createRegionSchema = z.object({
  name: nameSchema,
});

export type CreateRegionInput = z.infer<typeof createRegionSchema>;

export const updateRegionSchema = z.object({
  name: nameSchema,
});

export type UpdateRegionInput = z.infer<typeof updateRegionSchema>;

export const createGroupSchema = z.object({
  name: nameSchema,
  type: z.enum(GROUP_TYPES).default('komisi'),
  description: optionalText(500, 'Keterangan'),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const updateGroupSchema = z
  .object({
    name: nameSchema.optional(),
    type: z.enum(GROUP_TYPES).optional(),
    description: optionalText(500, 'Keterangan').nullable(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Tidak ada perubahan yang dikirim.');

export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;

export const setGroupMembersSchema = z.object({
  memberIds: z.array(z.string().uuid()).max(5000, 'Terlalu banyak anggota.'),
});

export type SetGroupMembersInput = z.infer<typeof setGroupMembersSchema>;

export const importActionSchema = z.enum(['skip', 'update']);
export type ImportAction = z.infer<typeof importActionSchema>;

/** Satu baris hasil validasi impor sebelum dikonfirmasi pengguna. */
export const importPreviewRowSchema = z.object({
  rowNumber: z.number().int(),
  data: createMemberSchema,
  errors: z.array(z.string()),
  duplicateOf: z.string().uuid().nullable(),
  action: importActionSchema,
});

export type ImportPreviewRow = z.infer<typeof importPreviewRowSchema>;
