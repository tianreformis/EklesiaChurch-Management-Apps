import { describe, expect, it } from 'vitest';
import {
  formatDateLong,
  formatDateShort,
  formatMonthYear,
  formatTime,
  toDateInputValue,
} from './date.js';

// 3 November 2026, 02:00 UTC == 09:00 WIB.
const sample = new Date('2026-11-03T02:00:00.000Z');

describe('formatDateLong', () => {
  it('memakai nama hari dan bulan Bahasa Indonesia', () => {
    expect(formatDateLong(sample)).toBe('Selasa, 3 November 2026');
  });

  it('menerima string ISO', () => {
    expect(formatDateLong('2026-11-03T02:00:00.000Z')).toBe('Selasa, 3 November 2026');
  });

  it('menolak tanggal tidak valid', () => {
    expect(() => formatDateLong('bukan-tanggal')).toThrow(TypeError);
  });
});

describe('formatDateShort', () => {
  it('memakai urutan hari/bulan/tahun', () => {
    expect(formatDateShort(sample)).toBe('03/11/2026');
  });
});

describe('formatTime', () => {
  it('menggunakan zona waktu Asia/Jakarta', () => {
    expect(formatTime(sample)).toBe('09.00');
  });
});

describe('formatMonthYear', () => {
  it('menampilkan bulan dan tahun', () => {
    expect(formatMonthYear(sample)).toBe('November 2026');
  });
});

describe('toDateInputValue', () => {
  it('menghasilkan format YYYY-MM-DD pada zona waktu Jakarta', () => {
    expect(toDateInputValue(new Date('2026-11-02T18:30:00.000Z'))).toBe('2026-11-03');
  });
});
