import { describe, expect, it } from 'vitest';
import { formatNumber, formatRupiah, parseRupiahInput } from './currency.js';

describe('formatRupiah', () => {
  it('memformat nol', () => {
    expect(formatRupiah(0)).toBe('Rp0');
  });

  it('memakai pemisah ribuan titik', () => {
    expect(formatRupiah(1_234_567)).toBe('Rp1.234.567');
  });

  it('memformat nominal negatif dengan tanda di depan', () => {
    expect(formatRupiah(-2_500)).toBe('-Rp2.500');
  });

  it('menolak nominal pecahan', () => {
    expect(() => formatRupiah(1500.5)).toThrow(TypeError);
  });

  it('menolak NaN', () => {
    expect(() => formatRupiah(Number.NaN)).toThrow(TypeError);
  });
});

describe('formatNumber', () => {
  it('memformat jumlah jemaat tanpa mata uang', () => {
    expect(formatNumber(12_345)).toBe('12.345');
  });
});

describe('parseRupiahInput', () => {
  it('membersihkan awalan Rp dan pemisah', () => {
    expect(parseRupiahInput('Rp 1.250.000')).toBe(1_250_000);
  });

  it('mengembalikan null untuk input kosong', () => {
    expect(parseRupiahInput('')).toBeNull();
    expect(parseRupiahInput('Rp')).toBeNull();
  });
});
