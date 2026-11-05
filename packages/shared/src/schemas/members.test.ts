import { describe, expect, it } from 'vitest';
import {
  createMemberSchema,
  memberFilterSchema,
  setGroupMembersSchema,
  updateMemberSchema,
} from './members.js';

describe('skema jemaat', () => {
  it('menerima anggota minimal dan memberi status aktif', () => {
    const parsed = createMemberSchema.parse({ fullName: 'Maria Simanjuntak' });
    expect(parsed.status).toBe('aktif');
    expect(parsed.fullName).toBe('Maria Simanjuntak');
  });

  it('menolak nama terlalu pendek dengan pesan Indonesia', () => {
    const result = createMemberSchema.safeParse({ fullName: 'A' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('minimal 2 karakter');
    }
  });

  it('mengubah tanggal kosong menjadi undefined', () => {
    const parsed = createMemberSchema.parse({ fullName: 'Budi Santoso', birthDate: '' });
    expect(parsed.birthDate).toBeUndefined();
  });

  it('menolak format tanggal yang salah', () => {
    const result = createMemberSchema.safeParse({ fullName: 'Budi Santoso', birthDate: '12-03-1985' });
    expect(result.success).toBe(false);
  });

  it('menolak email yang tidak valid', () => {
    const result = createMemberSchema.safeParse({ fullName: 'Budi Santoso', email: 'bukan-email' });
    expect(result.success).toBe(false);
  });

  it('filter bulan lahir dibatasi 1-12', () => {
    expect(memberFilterSchema.safeParse({ birthMonth: 13 }).success).toBe(false);
    expect(memberFilterSchema.parse({ birthMonth: '6' }).birthMonth).toBe(6);
    expect(memberFilterSchema.parse({}).page).toBe(1);
  });

  it('update wajib memuat minimal satu perubahan', () => {
    expect(updateMemberSchema.safeParse({}).success).toBe(false);
    expect(updateMemberSchema.safeParse({ phone: '0812' }).success).toBe(true);
  });

  it('daftar anggota komisi membatasi 5000 id', () => {
    const ids = Array.from({ length: 5001 }, () => '00000000-0000-0000-0000-000000000000');
    expect(setGroupMembersSchema.safeParse({ memberIds: ids }).success).toBe(false);
  });
});
