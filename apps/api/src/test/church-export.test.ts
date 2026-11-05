import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrateTestDatabase } from './setup.js';
import {
  CSRF_HEADERS,
  buildTestApp,
  clearAuthTables,
  createTestChurch,
  createTestUser,
  type TestContext,
} from './helpers.js';
import { members } from '../db/schema/index.js';

function sessionCookie(response: Response): string {
  const cookie = response.headers.getSetCookie().find((item) => item.startsWith('eklesia_session='));
  if (!cookie) {
    throw new Error('Cookie sesi tidak ditemukan.');
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
});

async function loginAs(email: string): Promise<string> {
  const response = await ctx.app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...CSRF_HEADERS },
    body: JSON.stringify({ email, password: 'Password123' }),
  });
  expect(response.status).toBe(200);
  return sessionCookie(response);
}

describe('ekspor data gereja (Fase 5)', () => {
  it('admin dapat mengunduh ekspor; peran lain ditolak; isi hanya gereja sendiri', async () => {
    await clearAuthTables(ctx.ownerDb);
    const churchA = await createTestChurch(ctx.ownerDb, { name: 'Gereja Ekspor A', slug: 'gereja-ekspor-a' });
    const churchB = await createTestChurch(ctx.ownerDb, { name: 'Gereja Ekspor B', slug: 'gereja-ekspor-b' });
    await ctx.ownerDb.insert(members).values([
      { churchId: churchA, fullName: 'Anggota Ekspor A', status: 'aktif' },
      { churchId: churchB, fullName: 'Anggota Ekspor B', status: 'aktif' },
    ]);
    const adminUser = await createTestUser(ctx.ownerDb, {
      churchId: churchA, name: 'Admin', email: ctx.unique('admin-ekspor'), role: 'admin_gereja',
    });
    const bendaharaUser = await createTestUser(ctx.ownerDb, {
      churchId: churchA, name: 'Bendahara', email: ctx.unique('bendahara-ekspor'), role: 'bendahara',
    });
    const admin = await loginAs(adminUser.email);
    const bendahara = await loginAs(bendaharaUser.email);

    const denied = await ctx.app.request('/api/church/export.xlsx', { headers: { Cookie: bendahara } });
    expect(denied.status).toBe(403);

    const exported = await ctx.app.request('/api/church/export.xlsx', { headers: { Cookie: admin } });
    expect(exported.status).toBe(200);
    expect(exported.headers.get('content-type')).toContain('spreadsheetml');

    const { default: ExcelJS } = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(await exported.arrayBuffer()) as unknown as ArrayBuffer);
    const sheetNames = workbook.worksheets.map((sheet) => sheet.name);
    expect(sheetNames).toContain('Anggota');
    expect(sheetNames).toContain('Transaksi');
    const memberSheet = workbook.getWorksheet('Anggota')!;
    const names: string[] = [];
    memberSheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        const values = row.values as unknown[];
        const nameCell = values.find((value) => typeof value === 'string' && value.includes('Anggota Ekspor'));
        if (nameCell) names.push(String(nameCell));
      }
    });
    expect(names).toContain('Anggota Ekspor A');
    expect(names).not.toContain('Anggota Ekspor B');
  });
});
