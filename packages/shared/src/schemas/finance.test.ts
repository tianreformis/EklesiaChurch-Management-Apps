import { describe, expect, it } from 'vitest';
import {
  amountSchema,
  createTransactionSchema,
  sundayOfferingSchema,
  voidTransactionSchema,
} from './finance.js';

describe('skema keuangan', () => {
  it('nominal wajib integer rupiah positif', () => {
    expect(amountSchema.safeParse(500_000).success).toBe(true);
    expect(amountSchema.safeParse(1500.5).success).toBe(false);
    expect(amountSchema.safeParse(-1000).success).toBe(false);
    expect(amountSchema.safeParse(0).success).toBe(false);
  });

  it('transaksi valid diterima', () => {
    const parsed = createTransactionSchema.parse({
      accountId: '00000000-0000-0000-0000-000000000000',
      categoryId: '00000000-0000-0000-0000-000000000000',
      type: 'in',
      amount: 100_000,
      date: '2026-11-02',
    });
    expect(parsed.amount).toBe(100_000);
  });

  it('alasan void minimal 5 karakter', () => {
    expect(voidTransactionSchema.safeParse({ reason: 'abc' }).success).toBe(false);
    expect(voidTransactionSchema.safeParse({ reason: 'Salah catat' }).success).toBe(true);
  });

  it('persembahan Minggu wajib penghitung, pemeriksa, dan minimal satu pos', () => {
    expect(
      sundayOfferingSchema.safeParse({
        serviceId: '00000000-0000-0000-0000-000000000000',
        accountId: '00000000-0000-0000-0000-000000000000',
        date: '2026-11-08',
        countedBy: 'Maria',
        verifiedBy: 'Yosua',
        entries: [],
      }).success,
    ).toBe(false);
    expect(
      sundayOfferingSchema.safeParse({
        serviceId: '00000000-0000-0000-0000-000000000000',
        accountId: '00000000-0000-0000-0000-000000000000',
        date: '2026-11-08',
        countedBy: 'Maria',
        verifiedBy: 'Yosua',
        entries: [{ categoryId: '00000000-0000-0000-0000-000000000000', amount: 50_000 }],
      }).success,
    ).toBe(true);
  });
});
