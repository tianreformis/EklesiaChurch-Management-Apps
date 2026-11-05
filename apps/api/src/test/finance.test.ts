import { rm } from 'node:fs/promises';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { migrateTestDatabase } from './setup.js';
import {
  CSRF_HEADERS,
  buildTestApp,
  clearAuthTables,
  createTestChurch,
  createTestUser,
  type TestContext,
} from './helpers.js';
import { resetRateLimits } from '../middleware/rate-limit.js';

function sessionCookie(response: Response): string {
  const cookie = response.headers.getSetCookie().find((item) => item.startsWith('eklesia_session='));
  if (!cookie) {
    throw new Error('Cookie sesi tidak ditemukan pada respons login.');
  }
  return cookie.split(';')[0]!;
}

let ctx: TestContext;

beforeAll(async () => {
  await migrateTestDatabase();
  ctx = buildTestApp();
});

afterAll(async () => {
  await ctx.close();
  await rm('test-attachments', { recursive: true, force: true });
});

beforeEach(() => {
  resetRateLimits();
});

async function loginAs(email: string, password = 'Password123'): Promise<string> {
  const response = await ctx.app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...CSRF_HEADERS },
    body: JSON.stringify({ email, password }),
  });
  expect(response.status).toBe(200);
  return sessionCookie(response);
}

function csrfJson(cookie: string, body: unknown, method = 'POST'): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookie, ...CSRF_HEADERS },
    body: JSON.stringify(body),
  };
}

interface Seeded {
  adminA: string;
  bendahara: string;
  majelis: string;
  pelayan: string;
  adminB: string;
  accountId: string;
  incomeCategoryId: string;
  expenseCategoryId: string;
}

async function seed(): Promise<Seeded> {
  await clearAuthTables(ctx.ownerDb);
  const churchA = await createTestChurch(ctx.ownerDb, { name: 'Gereja Uang A', slug: 'gereja-uang-a' });
  const churchB = await createTestChurch(ctx.ownerDb, { name: 'Gereja Uang B', slug: 'gereja-uang-b' });
  const adminUser = await createTestUser(ctx.ownerDb, {
    churchId: churchA, name: 'Admin A', email: ctx.unique('admin-uang'), role: 'admin_gereja',
  });
  const bendaharaUser = await createTestUser(ctx.ownerDb, {
    churchId: churchA, name: 'Bendahara', email: ctx.unique('bendahara'), role: 'bendahara',
  });
  const majelisUser = await createTestUser(ctx.ownerDb, {
    churchId: churchA, name: 'Majelis', email: ctx.unique('majelis-uang'), role: 'majelis',
  });
  const pelayanUser = await createTestUser(ctx.ownerDb, {
    churchId: churchA, name: 'Pelayan', email: ctx.unique('pelayan-uang'), role: 'pelayan',
  });
  const adminBUser = await createTestUser(ctx.ownerDb, {
    churchId: churchB, name: 'Admin B', email: ctx.unique('admin-uang-b'), role: 'admin_gereja',
  });

  const bendahara = await loginAs(bendaharaUser.email);
  const accountsRes = await ctx.app.request('/api/finance/accounts', { headers: { Cookie: bendahara } });
  const accounts = (await accountsRes.json()) as { items: { id: string; name: string }[] };
  const categoriesRes = await ctx.app.request('/api/finance/categories', { headers: { Cookie: bendahara } });
  const categories = (await categoriesRes.json()) as { items: { id: string; name: string; type: string }[] };

  return {
    adminA: await loginAs(adminUser.email),
    bendahara,
    majelis: await loginAs(majelisUser.email),
    pelayan: await loginAs(pelayanUser.email),
    adminB: await loginAs(adminBUser.email),
    accountId: accounts.items[0]!.id,
    incomeCategoryId: categories.items.find((item) => item.name === 'Perpuluhan')!.id,
    expenseCategoryId: categories.items.find((item) => item.name === 'Operasional' && item.type === 'out')!.id,
  };
}

function txBody(s: Seeded, overrides: Record<string, unknown> = {}) {
  return {
    accountId: s.accountId,
    categoryId: s.incomeCategoryId,
    type: 'in',
    amount: 500_000,
    date: '2026-11-02',
    description: 'Perpuluhan bulan November',
    ...overrides,
  };
}

describe('modul keuangan (Fase 4)', () => {
  it('kategori dan akun bawaan tersedia; nominal harus integer positif', async () => {
    const s = await seed();
    const categories = await ctx.app.request('/api/finance/categories', { headers: { Cookie: s.bendahara } });
    const body = (await categories.json()) as { items: { name: string }[] };
    expect(body.items.map((item) => item.name)).toContain('Perpuluhan');
    expect(body.items.map((item) => item.name)).toContain('Operasional');

    const floatAmount = await ctx.app.request(
      '/api/finance/transactions',
      csrfJson(s.bendahara, txBody(s, { amount: 1500.5 })),
    );
    expect(floatAmount.status).toBe(400);

    const negative = await ctx.app.request(
      '/api/finance/transactions',
      csrfJson(s.bendahara, txBody(s, { amount: -1000 })),
    );
    expect(negative.status).toBe(400);

    const mismatch = await ctx.app.request(
      '/api/finance/transactions',
      csrfJson(s.bendahara, txBody(s, { categoryId: s.expenseCategoryId })),
    );
    expect(mismatch.status).toBe(409);
  });

  it('rekonsiliasi laporan bulanan: saldo awal + masuk − keluar = saldo akhir', async () => {
    const s = await seed();
    // Saldo awal kas 1.000.000.
    const setOpening = await ctx.app.request(
      `/api/finance/accounts/${s.accountId}`,
      csrfJson(s.adminA, { openingBalance: 1_000_000 }, 'PATCH'),
    );
    expect(setOpening.status).toBe(200);

    // Transaksi Oktober memengaruhi saldo awal November.
    await ctx.app.request('/api/finance/transactions', csrfJson(s.bendahara, txBody(s, { amount: 100_000, date: '2026-10-05' })));
    // November: masuk 500rb, keluar 200rb.
    await ctx.app.request('/api/finance/transactions', csrfJson(s.bendahara, txBody(s)));
    await ctx.app.request(
      '/api/finance/transactions',
      csrfJson(s.bendahara, txBody(s, {
        categoryId: s.expenseCategoryId, type: 'out', amount: 200_000, date: '2026-11-10', description: 'Listrik',
      })),
    );

    const reportRes = await ctx.app.request('/api/finance/reports/monthly?year=2026&month=11', {
      headers: { Cookie: s.majelis },
    });
    expect(reportRes.status).toBe(200);
    const report = (await reportRes.json()) as {
      accounts: { openingBalance: number; totalIncome: number; totalExpense: number; closingBalance: number }[];
    };
    const account = report.accounts[0]!;
    expect(account.openingBalance).toBe(1_100_000);
    expect(account.totalIncome).toBe(500_000);
    expect(account.totalExpense).toBe(200_000);
    expect(account.closingBalance).toBe(1_400_000);
    expect(account.openingBalance + account.totalIncome - account.totalExpense).toBe(account.closingBalance);
  });

  it('void mengecualikan transaksi dari laporan dan tidak bisa di-void dua kali', async () => {
    const s = await seed();
    const created = await ctx.app.request('/api/finance/transactions', csrfJson(s.bendahara, txBody(s)));
    const createdBody = (await created.json()) as { id: string };

    const voided = await ctx.app.request(
      `/api/finance/transactions/${createdBody.id}/void`,
      csrfJson(s.bendahara, { reason: 'Salah catat nominal' }),
    );
    expect(voided.status).toBe(200);
    const voidedBody = (await voided.json()) as { status: string; voidReason: string };
    expect(voidedBody.status).toBe('void');

    const secondVoid = await ctx.app.request(
      `/api/finance/transactions/${createdBody.id}/void`,
      csrfJson(s.bendahara, { reason: 'Coba lagi' }),
    );
    expect(secondVoid.status).toBe(409);

    const report = (await (await ctx.app.request('/api/finance/reports/monthly?year=2026&month=11', {
      headers: { Cookie: s.bendahara },
    })).json()) as { totalIncome: number };
    expect(report.totalIncome).toBe(0);

    // Majelis tidak boleh void.
    const created2 = await ctx.app.request('/api/finance/transactions', csrfJson(s.bendahara, txBody(s)));
    const created2Body = (await created2.json()) as { id: string };
    const majelisVoid = await ctx.app.request(
      `/api/finance/transactions/${created2Body.id}/void`,
      csrfJson(s.majelis, { reason: 'Tidak berhak' }),
    );
    expect(majelisVoid.status).toBe(403);
  });

  it('periode terkunci menolak buat/ubah/void; hanya admin yang bisa membuka', async () => {
    const s = await seed();
    const created = await ctx.app.request('/api/finance/transactions', csrfJson(s.bendahara, txBody(s)));
    const txId = ((await created.json()) as { id: string }).id;

    const lock = await ctx.app.request(
      '/api/finance/period-locks',
      csrfJson(s.bendahara, { year: 2026, month: 11 }),
    );
    expect(lock.status).toBe(201);

    const createLocked = await ctx.app.request('/api/finance/transactions', csrfJson(s.bendahara, txBody(s)));
    expect(createLocked.status).toBe(403);

    const updateLocked = await ctx.app.request(
      `/api/finance/transactions/${txId}`,
      csrfJson(s.bendahara, { amount: 600_000 }, 'PATCH'),
    );
    expect(updateLocked.status).toBe(403);

    const voidLocked = await ctx.app.request(
      `/api/finance/transactions/${txId}/void`,
      csrfJson(s.bendahara, { reason: 'Koreksi' }),
    );
    expect(voidLocked.status).toBe(403);

    const bendaharaUnlock = await ctx.app.request('/api/finance/period-locks/2026/11', {
      method: 'DELETE',
      headers: { Cookie: s.bendahara, ...CSRF_HEADERS },
    });
    expect(bendaharaUnlock.status).toBe(403);

    const adminUnlock = await ctx.app.request('/api/finance/period-locks/2026/11', {
      method: 'DELETE',
      headers: { Cookie: s.adminA, ...CSRF_HEADERS },
    });
    expect(adminUnlock.status).toBe(200);

    const afterUnlock = await ctx.app.request('/api/finance/transactions', csrfJson(s.bendahara, txBody(s)));
    expect(afterUnlock.status).toBe(201);
  });

  it('izin: majelis baca saja, pelayan ditolak, bendahara menulis', async () => {
    const s = await seed();
    await ctx.app.request('/api/finance/transactions', csrfJson(s.bendahara, txBody(s)));

    const majelisRead = await ctx.app.request('/api/finance/transactions', { headers: { Cookie: s.majelis } });
    expect(majelisRead.status).toBe(200);
    const majelisWrite = await ctx.app.request('/api/finance/transactions', csrfJson(s.majelis, txBody(s)));
    expect(majelisWrite.status).toBe(403);

    const pelayanRead = await ctx.app.request('/api/finance/transactions', { headers: { Cookie: s.pelayan } });
    expect(pelayanRead.status).toBe(403);

    const majelisPdf = await ctx.app.request('/api/finance/reports/monthly.pdf?year=2026&month=11', {
      headers: { Cookie: s.majelis },
    });
    expect(majelisPdf.status).toBe(403);

    const bendaharaPdf = await ctx.app.request('/api/finance/reports/monthly.pdf?year=2026&month=11', {
      headers: { Cookie: s.bendahara },
    });
    expect(bendaharaPdf.status).toBe(200);
    expect(bendaharaPdf.headers.get('content-type')).toContain('application/pdf');
    const bytes = new Uint8Array(await bendaharaPdf.arrayBuffer());
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('%PDF');
  });

  it('form cepat persembahan Minggu mencatat banyak pos dengan penghitung/pemeriksa', async () => {
    const s = await seed();
    const service = await ctx.app.request(
      '/api/schedule/services',
      csrfJson(s.adminA, { title: 'Ibadah Minggu', date: '2026-11-08', startTime: '09:00' }),
    );
    const serviceBody = (await service.json()) as { items: { id: string }[] };

    const categories = (await (await ctx.app.request('/api/finance/categories', {
      headers: { Cookie: s.bendahara },
    })).json()) as { items: { id: string; name: string; type: string }[] };
    const minggu = categories.items.find((item) => item.name === 'Persembahan Minggu')!;

    const offering = await ctx.app.request(
      '/api/finance/offerings',
      csrfJson(s.bendahara, {
        serviceId: serviceBody.items[0]!.id,
        accountId: s.accountId,
        date: '2026-11-08',
        countedBy: 'Ibu Maria',
        verifiedBy: 'Bapak Yosua',
        entries: [
          { categoryId: minggu.id, amount: 750_000 },
          { categoryId: s.incomeCategoryId, amount: 250_000 },
        ],
      }),
    );
    expect(offering.status).toBe(201);
    const offeringBody = (await offering.json()) as { items: { countedBy: string }[]; total: number };
    expect(offeringBody.total).toBe(1_000_000);
    expect(offeringBody.items[0]!.countedBy).toBe('Ibu Maria');
  });

  it('lampiran: gambar valid tersimpan dan hanya dapat dibuka gereja pemilik', async () => {
    const s = await seed();
    const created = await ctx.app.request('/api/finance/transactions', csrfJson(s.bendahara, txBody(s)));
    const txId = ((await created.json()) as { id: string }).id;

    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
    const form = new FormData();
    form.append('file', new File([pngBytes], 'bukti.png', { type: 'image/png' }));
    const upload = await ctx.app.request(`/api/finance/transactions/${txId}/attachment`, {
      method: 'POST',
      headers: { Cookie: s.bendahara, ...CSRF_HEADERS },
      body: form,
    });
    expect(upload.status).toBe(200);
    const uploadBody = (await upload.json()) as { attachmentFile: string };
    expect(uploadBody.attachmentFile).toMatch(/\.png$/);

    const view = await ctx.app.request(`/api/finance/attachments/${uploadBody.attachmentFile}`, {
      headers: { Cookie: s.majelis },
    });
    expect(view.status).toBe(200);
    expect(view.headers.get('content-type')).toContain('image/png');

    const crossView = await ctx.app.request(`/api/finance/attachments/${uploadBody.attachmentFile}`, {
      headers: { Cookie: s.adminB },
    });
    expect(crossView.status).toBe(404);

    const fakeForm = new FormData();
    fakeForm.append('file', new File([new TextEncoder().encode('ini bukan gambar')], 'bukti.png', { type: 'image/png' }));
    const fakeUpload = await ctx.app.request(`/api/finance/transactions/${txId}/attachment`, {
      method: 'POST',
      headers: { Cookie: s.bendahara, ...CSRF_HEADERS },
      body: fakeForm,
    });
    expect(fakeUpload.status).toBe(400);
  });

  it('isolasi tenant keuangan gereja A vs B', async () => {
    const s = await seed();
    const created = await ctx.app.request('/api/finance/transactions', csrfJson(s.bendahara, txBody(s)));
    const txId = ((await created.json()) as { id: string }).id;

    const crossRead = await ctx.app.request(`/api/finance/transactions/${txId}`, {
      headers: { Cookie: s.adminB },
    });
    expect(crossRead.status).toBe(404);

    const listB = (await (await ctx.app.request('/api/finance/transactions', {
      headers: { Cookie: s.adminB },
    })).json()) as { items: unknown[] };
    expect(listB.items.length).toBe(0);

    const crossVoid = await ctx.app.request(
      `/api/finance/transactions/${txId}/void`,
      csrfJson(s.adminB, { reason: 'Coba void silang' }),
    );
    expect(crossVoid.status).toBe(404);
  });
});
