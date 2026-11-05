import { describe, expect, it } from 'vitest';
import {
  createServiceSchema,
  respondSwapSchema,
  serviceFilterSchema,
  updateServiceSchema,
} from './schedule.js';

describe('skema jadwal', () => {
  it('ibadah valid dengan pengulangan default 1 kali', () => {
    const parsed = createServiceSchema.parse({
      title: 'Ibadah Minggu',
      date: '2026-11-08',
      startTime: '09:00',
    });
    expect(parsed.recurrenceWeeks).toBe(1);
  });

  it('menolak jam yang tidak valid', () => {
    const result = createServiceSchema.safeParse({
      title: 'Ibadah Minggu',
      date: '2026-11-08',
      startTime: '25:00',
    });
    expect(result.success).toBe(false);
  });

  it('menolak tanggal format Indonesia', () => {
    const result = createServiceSchema.safeParse({
      title: 'Ibadah Minggu',
      date: '08-11-2026',
      startTime: '09:00',
    });
    expect(result.success).toBe(false);
  });

  it('pengulangan dibatasi maksimal 52 minggu', () => {
    const result = createServiceSchema.safeParse({
      title: 'Ibadah Minggu',
      date: '2026-11-08',
      startTime: '09:00',
      recurrenceWeeks: 53,
    });
    expect(result.success).toBe(false);
  });

  it('filter bulan wajib format YYYY-MM', () => {
    expect(serviceFilterSchema.safeParse({ month: '2026-11' }).success).toBe(true);
    expect(serviceFilterSchema.safeParse({ month: '2026-13' }).success).toBe(false);
  });

  it('update ibadah kosong ditolak', () => {
    expect(updateServiceSchema.safeParse({}).success).toBe(false);
    expect(updateServiceSchema.safeParse({ status: 'selesai' }).success).toBe(true);
  });

  it('jawaban tukar wajib boolean', () => {
    expect(respondSwapSchema.safeParse({ accept: true }).success).toBe(true);
    expect(respondSwapSchema.safeParse({ accept: 'ya' }).success).toBe(false);
  });
});
