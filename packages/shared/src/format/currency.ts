import { APP_LOCALE } from '../constants.js';

const thousandSeparator = new Intl.NumberFormat(APP_LOCALE, {
  maximumFractionDigits: 0,
});

/**
 * Format integer rupiah untuk tampilan, mis. 1234567 -> "Rp1.234.567".
 *
 * Nominal di aplikasi selalu integer rupiah (tanpa sen). Nilai pecahan dianggap
 * kesalahan programmer, jadi dilempar agar tidak diam-diam dibulatkan.
 */
export function formatRupiah(amount: number): string {
  if (!Number.isFinite(amount)) {
    throw new TypeError('Nominal harus berupa angka yang valid.');
  }
  if (!Number.isInteger(amount)) {
    throw new TypeError('Nominal harus berupa integer rupiah (tanpa sen).');
  }

  const sign = amount < 0 ? '-' : '';
  return `${sign}Rp${thousandSeparator.format(Math.abs(amount))}`;
}

/** Format angka tanpa mata uang, mis. 1234567 -> "1.234.567". */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new TypeError('Angka harus berupa nilai yang valid.');
  }
  return thousandSeparator.format(value);
}

/**
 * Mengubah input pengguna seperti "Rp 1.250.000" atau "1250000" menjadi
 * integer rupiah. Mengembalikan `null` bila input tidak valid.
 */
export function parseRupiahInput(value: string): number | null {
  const cleaned = value.replace(/[^0-9-]/g, '');
  if (cleaned === '' || cleaned === '-') {
    return null;
  }

  const parsed = Number.parseInt(cleaned, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}
