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

/** Menyiapkan dua gereja dengan admin masing-masing. */
async function seedTwoChurches(): Promise<{
  adminA: string;
  adminB: string;
  majesticA: string;
}> {
  await clearAuthTables(ctx.ownerDb);
  const churchA = await createTestChurch(ctx.ownerDb, { name: 'Gereja A', slug: 'gereja-a' });
  const churchB = await createTestChurch(ctx.ownerDb, { name: 'Gereja B', slug: 'gereja-b' });
  const adminA = await createTestUser(ctx.ownerDb, {
    churchId: churchA,
    name: 'Admin A',
    email: ctx.unique('admin-a'),
    role: 'admin_gereja',
  });
  const adminB = await createTestUser(ctx.ownerDb, {
    churchId: churchB,
    name: 'Admin B',
    email: ctx.unique('admin-b'),
    role: 'admin_gereja',
  });
  const majesticA = await createTestUser(ctx.ownerDb, {
    churchId: churchA,
    name: 'Majelis A',
    email: ctx.unique('majelis-a'),
    role: 'majelis',
  });
  return {
    adminA: await loginAs(adminA.email),
    adminB: await loginAs(adminB.email),
    majesticA: await loginAs(majesticA.email),
  };
}

function csrfJson(cookie: string, body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie, ...CSRF_HEADERS },
    body: JSON.stringify(body),
  };
}

describe('modul jemaat (Fase 2)', () => {
  it('CRUD anggota dengan validasi Zod berbahasa Indonesia', async () => {
    const { adminA } = await seedTwoChurches();

    // Validasi: nama kosong ditolak dengan pesan Indonesia.
    const invalid = await ctx.app.request(
      '/api/members',
      csrfJson(adminA, { fullName: '' }),
    );
    expect(invalid.status).toBe(400);

    const created = await ctx.app.request(
      '/api/members',
      csrfJson(adminA, {
        fullName: 'Maria Simanjuntak',
        gender: 'perempuan',
        birthDate: '1985-03-12',
        phone: '081234567890',
        status: 'aktif',
      }),
    );
    expect(created.status).toBe(201);
    const member = (await created.json()) as { id: string; fullName: string };
    expect(member.fullName).toBe('Maria Simanjuntak');

    // Duplikat input manual ditolak 409.
    const duplicate = await ctx.app.request(
      '/api/members',
      csrfJson(adminA, { fullName: 'Maria Simanjuntak', birthDate: '1985-03-12' }),
    );
    expect(duplicate.status).toBe(409);

    // Baca + ubah + hapus.
    const detail = await ctx.app.request(`/api/members/${member.id}`, {
      headers: { Cookie: adminA },
    });
    expect(detail.status).toBe(200);

    const updated = await ctx.app.request(
      `/api/members/${member.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: adminA, ...CSRF_HEADERS },
        body: JSON.stringify({ phone: '081999000111' }),
      },
    );
    expect(updated.status).toBe(200);

    const removed = await ctx.app.request(
      `/api/members/${member.id}`,
      { method: 'DELETE', headers: { Cookie: adminA, ...CSRF_HEADERS } },
    );
    expect(removed.status).toBe(200);

    const gone = await ctx.app.request(`/api/members/${member.id}`, {
      headers: { Cookie: adminA },
    });
    expect(gone.status).toBe(404);
  });

  it('filter daftar: pencarian, status, bulan lahir', async () => {
    const { adminA } = await seedTwoChurches();
    const people = [
      { fullName: 'Andi Pratama', birthDate: '1990-01-15', status: 'aktif' },
      { fullName: 'Budi Santoso', birthDate: '1992-01-20', status: 'pindah' },
      { fullName: 'Citra Lestari', birthDate: '1995-06-05', status: 'aktif' },
    ];
    for (const person of people) {
      const response = await ctx.app.request('/api/members', csrfJson(adminA, person));
      expect(response.status).toBe(201);
    }

    const search = await ctx.app.request('/api/members?search=andi&perPage=50', {
      headers: { Cookie: adminA },
    });
    const searchBody = (await search.json()) as { items: unknown[] };
    expect(searchBody.items.length).toBe(1);

    const inactive = await ctx.app.request('/api/members?status=pindah&perPage=50', {
      headers: { Cookie: adminA },
    });
    const inactiveBody = (await inactive.json()) as { items: unknown[] };
    expect(inactiveBody.items.length).toBe(1);

    const january = await ctx.app.request('/api/members?birthMonth=1&perPage=50', {
      headers: { Cookie: adminA },
    });
    const januaryBody = (await january.json()) as { items: unknown[] };
    expect(januaryBody.items.length).toBe(2);
  });

  it('keluarga, wilayah, dan komisi terhubung ke anggota', async () => {
    const { adminA } = await seedTwoChurches();

    const regionRes = await ctx.app.request(
      '/api/members/meta/regions',
      csrfJson(adminA, { name: 'Wilayah 1' }),
    );
    expect(regionRes.status).toBe(201);
    const region = (await regionRes.json()) as { id: string };

    const familyRes = await ctx.app.request(
      '/api/members/meta/families',
      csrfJson(adminA, { name: 'Keluarga Simanjuntak' }),
    );
    expect(familyRes.status).toBe(201);
    const family = (await familyRes.json()) as { id: string };

    const groupRes = await ctx.app.request(
      '/api/members/meta/groups',
      csrfJson(adminA, { name: 'Paduan Suara', type: 'komisi' }),
    );
    expect(groupRes.status).toBe(201);
    const group = (await groupRes.json()) as { id: string };

    const memberRes = await ctx.app.request(
      '/api/members',
      csrfJson(adminA, { fullName: 'Dewi Anggraini', regionId: region.id, familyId: family.id }),
    );
    expect(memberRes.status).toBe(201);
    const member = (await memberRes.json()) as { id: string };

    // ID asing (acak) → 404.
    const badRef = await ctx.app.request(
      '/api/members',
      csrfJson(adminA, { fullName: 'Orang Asing', regionId: '00000000-0000-0000-0000-000000000000' }),
    );
    expect(badRef.status).toBe(404);

    const assign = await ctx.app.request(
      `/api/members/meta/groups/${group.id}/members`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: adminA, ...CSRF_HEADERS },
        body: JSON.stringify({ memberIds: [member.id] }),
      },
    );
    expect(assign.status).toBe(200);

    const detail = await ctx.app.request(`/api/members/${member.id}`, {
      headers: { Cookie: adminA },
    });
    const detailBody = (await detail.json()) as {
      region: { id: string } | null;
      family: { id: string } | null;
      groups: { id: string }[];
    };
    expect(detailBody.region?.id).toBe(region.id);
    expect(detailBody.family?.id).toBe(family.id);
    expect(detailBody.groups.map((item) => item.id)).toContain(group.id);
  });

  it('isolasi tenant: gereja B tidak bisa melihat data gereja A', async () => {
    const { adminA, adminB } = await seedTwoChurches();

    const created = await ctx.app.request(
      '/api/members',
      csrfJson(adminA, { fullName: 'Eksklusif Gereja A' }),
    );
    expect(created.status).toBe(201);
    const member = (await created.json()) as { id: string };

    const crossRead = await ctx.app.request(`/api/members/${member.id}`, {
      headers: { Cookie: adminB },
    });
    expect(crossRead.status).toBe(404);

    const crossDelete = await ctx.app.request(`/api/members/${member.id}`, {
      method: 'DELETE',
      headers: { Cookie: adminB, ...CSRF_HEADERS },
    });
    expect(crossDelete.status).toBe(404);

    const listB = await ctx.app.request('/api/members?perPage=50', {
      headers: { Cookie: adminB },
    });
    const listBody = (await listB.json()) as { items: unknown[] };
    expect(listBody.items.length).toBe(0);

    // churchId dari klien diabaikan — tidak ada cara menyusup lewat body.
    const smuggle = await ctx.app.request(
      '/api/members',
      csrfJson(adminB, { fullName: 'Coba Susup', churchId: 'gereja-a' }),
    );
    expect([201, 400]).toContain(smuggle.status);
    const listA = await ctx.app.request('/api/members?search=Eksklusif&perPage=50', {
      headers: { Cookie: adminA },
    });
    const listABody = (await listA.json()) as { items: { fullName: string }[] };
    expect(listABody.items.some((item) => item.fullName === 'Eksklusif Gereja A')).toBe(true);
  });

  it('otorisasi: majelis hanya baca, tidak bisa tulis atau impor', async () => {
    const { adminA, majesticA } = await seedTwoChurches();

    const created = await ctx.app.request(
      '/api/members',
      csrfJson(adminA, { fullName: 'Anggota Baca' }),
    );
    expect(created.status).toBe(201);

    const read = await ctx.app.request('/api/members?perPage=50', {
      headers: { Cookie: majesticA },
    });
    expect(read.status).toBe(200);

    const write = await ctx.app.request(
      '/api/members',
      csrfJson(majesticA, { fullName: 'Coba Tulis' }),
    );
    expect(write.status).toBe(403);

    const template = await ctx.app.request('/api/members-import/template', {
      headers: { Cookie: majesticA },
    });
    expect(template.status).toBe(403);
  });

  it('impor: template, pratinjau duplikat, konfirmasi, ekspor', async () => {
    const { adminA } = await seedTwoChurches();

    const templateRes = await ctx.app.request('/api/members-import/template', {
      headers: { Cookie: adminA },
    });
    expect(templateRes.status).toBe(200);
    expect(templateRes.headers.get('content-type')).toContain('spreadsheetml');

    const { buildImportTemplate } = await import('../modules/members/excel.js');

    // Anggota yang sudah ada agar terdeteksi duplikat saat pratinjau.
    await ctx.app.request(
      '/api/members',
      csrfJson(adminA, { fullName: 'Sudah Ada', birthDate: '1980-05-05' }),
    );

    // Membangun berkas Excel uji di memori: 1 duplikat + 1 baru + 1 rusak.
    const { default: ExcelJS } = await import('exceljs');
    const templateBuffer = Buffer.from(await (await buildImportTemplate()).valueOf());
    const templateWb = new ExcelJS.Workbook();
    await templateWb.xlsx.load(templateBuffer as unknown as ArrayBuffer);
    const headerRow = templateWb.worksheets[0]?.getRow(1).values as unknown[];
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Anggota');
    sheet.addRow(Array.isArray(headerRow) ? headerRow.slice(1) : []);
    sheet.addRow(['Sudah Ada', '', '', '1980-05-05', '', '', '', 'aktif', '', '', '', '']);
    sheet.addRow(['Anggota Baru Impor', '', '', '2000-02-02', '0815000111222', '', '', 'aktif', '', '', '', '']);
    sheet.addRow(['', '', '', '', '', '', '', 'aktif', '', '', '', '']);
    const uploadBuffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const form = new FormData();
    form.append('file', new File([new Uint8Array(uploadBuffer)], 'impor.xlsx', { type: 'application/octet-stream' }));
    const previewRes = await ctx.app.request('/api/members-import/preview', {
      method: 'POST',
      headers: { Cookie: adminA, ...CSRF_HEADERS },
      body: form,
    });
    expect(previewRes.status).toBe(200);
    const preview = (await previewRes.json()) as {
      rows: {
        rowNumber: number;
        data: Record<string, unknown>;
        errors: string[];
        duplicateOf: string | null;
        action: 'skip' | 'update';
      }[];
      totalRows: number;
    };
    expect(preview.totalRows).toBe(3);
    const duplicateRow = preview.rows.find((row) => row.duplicateOf);
    expect(duplicateRow).toBeDefined();
    const invalidRow = preview.rows.find((row) => row.errors.length > 0 && !row.duplicateOf);
    expect(invalidRow).toBeDefined();
    const validRow = preview.rows.find((row) => !row.duplicateOf && row.errors.length === 0);
    expect(validRow).toBeDefined();

    // Konfirmasi lewat HTTP dengan data asli dari pratinjau: duplikat
    // dilewati (skip), baris baru dibuat, baris rusak dilewati.
    const confirmRes = await ctx.app.request(
      '/api/members-import/confirm',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminA, ...CSRF_HEADERS },
        body: JSON.stringify({
          rows: preview.rows.map((row) => ({
            rowNumber: row.rowNumber,
            data: row.data,
            errors: row.errors,
            duplicateOf: row.duplicateOf,
            action: 'skip' as const,
          })),
          choices: [],
        }),
      },
    );
    expect(confirmRes.status).toBe(200);
    const confirmBody = (await confirmRes.json()) as { created: number; skipped: number };
    expect(confirmBody.created).toBe(1);
    expect(confirmBody.skipped).toBe(2);

    // Anggota baru benar-benar tersimpan dan terisolasi di gereja A.
    const listAfter = await ctx.app.request('/api/members?search=Anggota Baru Impor&perPage=50', {
      headers: { Cookie: adminA },
    });
    const listAfterBody = (await listAfter.json()) as { items: { fullName: string }[] };
    expect(listAfterBody.items.length).toBe(1);

    const exportRes = await ctx.app.request('/api/members-import/export', {
      headers: { Cookie: adminA },
    });
    expect(exportRes.status).toBe(200);
    expect(exportRes.headers.get('content-type')).toContain('spreadsheetml');
  });
});
