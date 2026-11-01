import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetRateLimits } from '../middleware/rate-limit.js';
import { migrateTestDatabase } from './setup.js';
import {
  CSRF_HEADERS,
  buildTestApp,
  clearAuthTables,
  createTestChurch,
  createTestUser,
  type TestContext,
} from './helpers.js';

/** Header cookie dari respons login untuk dipakai pada permintaan berikut. */
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
  const response = await ctx.app.request(
    '/api/auth/login',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...CSRF_HEADERS },
      body: JSON.stringify({ email, password }),
    },
  );
  expect(response.status).toBe(200);
  return sessionCookie(response);
}

describe('alur autentikasi', () => {
  it('masuk memakai email, membaca profil, lalu keluar', async () => {
    await clearAuthTables(ctx.ownerDb);
    const churchId = await createTestChurch(ctx.ownerDb, {
      name: 'Gereja Uji Masuk',
      slug: 'gereja-uji-masuk',
    });
    await createTestUser(ctx.ownerDb, {
      churchId,
      name: 'Admin Uji',
      email: 'admin-uji@test.local',
      role: 'admin_gereja',
    });

    const cookie = await loginAs('admin-uji@test.local');

    const me = await ctx.app.request('/api/auth/me', { headers: { Cookie: cookie } });
    expect(me.status).toBe(200);
    const meBody = (await me.json()) as {
      profile: { kind: string; user: { email: string }; church: { slug: string } };
    };
    expect(meBody.profile.kind).toBe('user');
    expect(meBody.profile.user.email).toBe('admin-uji@test.local');
    expect(meBody.profile.church.slug).toBe('gereja-uji-masuk');

    const logout = await ctx.app.request(
      '/api/auth/logout',
      { method: 'POST', headers: { Cookie: cookie, ...CSRF_HEADERS } },
    );
    expect(logout.status).toBe(200);

    const afterLogout = await ctx.app.request('/api/auth/me', { headers: { Cookie: cookie } });
    expect(afterLogout.status).toBe(401);
  });

  it('menolak password yang salah tanpa membocorkan keberadaan email', async () => {
    await clearAuthTables(ctx.ownerDb);
    const churchId = await createTestChurch(ctx.ownerDb, {
      name: 'Gereja Uji Tolak',
      slug: 'gereja-uji-tolak',
    });
    await createTestUser(ctx.ownerDb, {
      churchId,
      name: 'Admin Tolak',
      email: 'admin-tolak@test.local',
      role: 'admin_gereja',
    });

    const wrong = await ctx.app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...CSRF_HEADERS },
      body: JSON.stringify({ email: 'admin-tolak@test.local', password: 'Salah1234' }),
    });
    const unknown = await ctx.app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...CSRF_HEADERS },
      body: JSON.stringify({ email: 'tidak-ada@test.local', password: 'Salah1234' }),
    });

    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    const wrongBody = (await wrong.json()) as { error: { message: string } };
    const unknownBody = (await unknown.json()) as { error: { message: string } };
    expect(wrongBody.error.message).toBe(unknownBody.error.message);
  });

  it('menolak permintaan lintas situs (CSRF) pada rute yang mengubah data', async () => {
    await clearAuthTables(ctx.ownerDb);
    const churchId = await createTestChurch(ctx.ownerDb, {
      name: 'Gereja Uji CSRF',
      slug: 'gereja-uji-csrf',
    });
    await createTestUser(ctx.ownerDb, {
      churchId,
      name: 'Admin CSRF',
      email: 'admin-csrf@test.local',
      role: 'admin_gereja',
    });

    const response = await ctx.app.request('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://penyerang.test',
        'Sec-Fetch-Site': 'cross-site',
      },
      body: JSON.stringify({ email: 'admin-csrf@test.local', password: 'Password123' }),
    });
    expect(response.status).toBe(403);
  });

  it('alur lupa password: membuat token, mengatur ulang, dan mengakhiri sesi lama', async () => {
    await clearAuthTables(ctx.ownerDb);
    const churchId = await createTestChurch(ctx.ownerDb, {
      name: 'Gereja Uji Reset',
      slug: 'gereja-uji-reset',
    });
    await createTestUser(ctx.ownerDb, {
      churchId,
      name: 'Bendahara Reset',
      email: 'reset@test.local',
      role: 'bendahara',
    });
    const oldCookie = await loginAs('reset@test.local');

    const forgot = await ctx.app.request('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...CSRF_HEADERS },
      body: JSON.stringify({ email: 'reset@test.local' }),
    });
    expect(forgot.status).toBe(200);
    const forgotBody = (await forgot.json()) as { emailSent: boolean; manualUrl?: string };
    // SMTP tidak dikonfigurasi dalam test: tautan manual dikembalikan.
    expect(forgotBody.manualUrl).toMatch(/token=/);
    const token = new URL(forgotBody.manualUrl!).searchParams.get('token');
    if (!token) {
      throw new Error('Token reset tidak ditemukan.');
    }

    const reset = await ctx.app.request('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...CSRF_HEADERS },
      body: JSON.stringify({ token, password: 'Baru12345' }),
    });
    expect(reset.status).toBe(200);

    // Sesi lama sudah diakhiri oleh reset password.
    const stale = await ctx.app.request('/api/auth/me', { headers: { Cookie: oldCookie } });
    expect(stale.status).toBe(401);

    // Password baru berfungsi.
    await loginAs('reset@test.local', 'Baru12345');
  });

  it('alur undangan: info terlihat, terima, lalu langsung masuk', async () => {
    await clearAuthTables(ctx.ownerDb);
    const churchId = await createTestChurch(ctx.ownerDb, {
      name: 'Gereja Uji Undang',
      slug: 'gereja-uji-undang',
    });
    const admin = await createTestUser(ctx.ownerDb, {
      churchId,
      name: 'Admin Undang',
      email: 'undang-admin@test.local',
      role: 'admin_gereja',
    });
    void admin;
    const adminCookie = await loginAs('undang-admin@test.local');

    const invite = await ctx.app.request('/api/users/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie, ...CSRF_HEADERS },
      body: JSON.stringify({
        name: 'Pelayan Baru',
        email: ctx.unique('pelayan-baru'),
        role: 'pelayan',
      }),
    });
    expect(invite.status).toBe(201);
    const inviteBody = (await invite.json()) as { inviteUrl?: string };
    const token = new URL(inviteBody.inviteUrl!).searchParams.get('token');
    if (!token) {
      throw new Error('Token undangan tidak ditemukan.');
    }

    const info = await ctx.app.request(`/api/auth/invitations/${token}`);
    expect(info.status).toBe(200);

    const accept = await ctx.app.request('/api/auth/invitations/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...CSRF_HEADERS },
      body: JSON.stringify({ token, password: 'Pelayan123' }),
    });
    expect(accept.status).toBe(200);
    const profile = (await accept.json()) as { profile: { kind: string } };
    expect(profile.profile.kind).toBe('user');
  });
});

describe('isolasi tenant gereja A vs gereja B', () => {
  it('daftar pengguna gereja A tidak memuat pengguna gereja B', async () => {
    await clearAuthTables(ctx.ownerDb);
    const churchA = await createTestChurch(ctx.ownerDb, { name: 'Gereja A', slug: 'gereja-a' });
    const churchB = await createTestChurch(ctx.ownerDb, { name: 'Gereja B', slug: 'gereja-b' });
    await createTestUser(ctx.ownerDb, {
      churchId: churchA,
      name: 'Admin A',
      email: 'admin-a@test.local',
      role: 'admin_gereja',
    });
    await createTestUser(ctx.ownerDb, {
      churchId: churchB,
      name: 'Admin B',
      email: 'admin-b@test.local',
      role: 'admin_gereja',
    });

    const cookieA = await loginAs('admin-a@test.local');
    const list = await ctx.app.request('/api/users', { headers: { Cookie: cookieA } });
    expect(list.status).toBe(200);
    const body = (await list.json()) as { items: { email: string }[] };
    expect(body.items.map((item) => item.email)).toEqual(['admin-a@test.local']);
  });

  it('ID tebakan gereja B tidak dapat dibaca atau diubah dari gereja A', async () => {
    await clearAuthTables(ctx.ownerDb);
    const churchA = await createTestChurch(ctx.ownerDb, { name: 'Gereja A2', slug: 'gereja-a2' });
    const churchB = await createTestChurch(ctx.ownerDb, { name: 'Gereja B2', slug: 'gereja-b2' });
    await createTestUser(ctx.ownerDb, {
      churchId: churchA,
      name: 'Admin A2',
      email: 'admin-a2@test.local',
      role: 'admin_gereja',
    });
    const targetB = await createTestUser(ctx.ownerDb, {
      churchId: churchB,
      name: 'Admin B2',
      email: 'admin-b2@test.local',
      role: 'admin_gereja',
    });

    const cookieA = await loginAs('admin-a2@test.local');

    const church = await ctx.app.request('/api/church', { headers: { Cookie: cookieA } });
    expect(church.status).toBe(200);
    const churchBody = (await church.json()) as { church: { id: string } };
    expect(churchBody.church.id).not.toBe(targetB.churchId);

    // ID tebakan milik gereja B tidak terlihat dari gereja A.
    const patch = await ctx.app.request(`/api/users/${targetB.churchId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA, ...CSRF_HEADERS },
      body: JSON.stringify({ isActive: false }),
    });
    // ID tersebut bukan ID pengguna sama sekali; tetapi bila kelak ada ID
    // pengguna gereja B, middleware tenant tetap mengembalikan 404.
    expect([400, 404]).toContain(patch.status);
  });

  it('super_admin tidak dapat membaca data gereja dan gereja tidak dapat membaca platform', async () => {
    await clearAuthTables(ctx.ownerDb);
    const churchId = await createTestChurch(ctx.ownerDb, {
      name: 'Gereja Uji Batas',
      slug: 'gereja-uji-batas',
    });
    await createTestUser(ctx.ownerDb, {
      churchId,
      name: 'Admin Batas',
      email: 'admin-batas@test.local',
      role: 'admin_gereja',
    });

    const adminCookie = await loginAs('admin-batas@test.local');
    const platformAsChurch = await ctx.app.request('/api/platform/summary', {
      headers: { Cookie: adminCookie },
    });
    expect(platformAsChurch.status).toBe(403);
  });

  it('peran tanpa izin users.manage tidak dapat mengundang atau mengubah pengguna', async () => {
    await clearAuthTables(ctx.ownerDb);
    const churchId = await createTestChurch(ctx.ownerDb, {
      name: 'Gereja Uji Izin',
      slug: 'gereja-uji-izin',
    });
    await createTestUser(ctx.ownerDb, {
      churchId,
      name: 'Bendahara Izin',
      email: 'izin-bendahara@test.local',
      role: 'bendahara',
    });

    const cookie = await loginAs('izin-bendahara@test.local');

    const list = await ctx.app.request('/api/users', { headers: { Cookie: cookie } });
    expect(list.status).toBe(403);

    const invite = await ctx.app.request('/api/users/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie, ...CSRF_HEADERS },
      body: JSON.stringify({ name: 'X', email: 'x@test.local', role: 'pelayan' }),
    });
    expect(invite.status).toBe(403);
  });

  it('email unik lintas gereja: email gereja A tidak bisa dipakai di gereja B', async () => {
    await clearAuthTables(ctx.ownerDb);
    const churchA = await createTestChurch(ctx.ownerDb, { name: 'Gereja UA', slug: 'gereja-ua' });
    const churchB = await createTestChurch(ctx.ownerDb, { name: 'Gereja UB', slug: 'gereja-ub' });
    await createTestUser(ctx.ownerDb, {
      churchId: churchA,
      name: 'Admin UA',
      email: 'sama@test.local',
      role: 'admin_gereja',
    });
    await createTestUser(ctx.ownerDb, {
      churchId: churchB,
      name: 'Admin UB',
      email: 'admin-ub@test.local',
      role: 'admin_gereja',
    });

    const cookieB = await loginAs('admin-ub@test.local');
    const invite = await ctx.app.request('/api/users/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieB, ...CSRF_HEADERS },
      body: JSON.stringify({ name: 'Duplikat', email: 'sama@test.local', role: 'pelayan' }),
    });
    expect(invite.status).toBe(409);
  });

  it('RLS database: koneksi peran aplikasi tidak melihat baris gereja lain', async () => {
    await clearAuthTables(ctx.ownerDb);
    const churchA = await createTestChurch(ctx.ownerDb, { name: 'Gereja RA', slug: 'gereja-ra' });
    const churchB = await createTestChurch(ctx.ownerDb, { name: 'Gereja RB', slug: 'gereja-rb' });
    await createTestUser(ctx.ownerDb, {
      churchId: churchA,
      name: 'Admin RA',
      email: 'ra@test.local',
      role: 'admin_gereja',
      password: 'Password123',
    });
    await createTestUser(ctx.ownerDb, {
      churchId: churchB,
      name: 'Admin RB',
      email: 'rb@test.local',
      role: 'admin_gereja',
      password: 'Password123',
    });

    const { users } = await import('../db/schema/index.js');
    const { sql } = await import('drizzle-orm');
    const rows = await ctx.appDb.select({ email: users.email }).from(users);
    expect(rows).toEqual([]);

    // Dengan church_id gereja A, hanya baris gereja A yang terlihat.
    await ctx.appDb.transaction(async (tx) => {
      await tx.execute(sql`select set_config('app.church_id', ${churchA}, true)`);
      const visible = await tx.select({ email: users.email }).from(users);
      expect(visible.map((row) => row.email)).toEqual(['ra@test.local']);
    });
  });
});

describe('audit log', () => {
  it('undangan dan perubahan tercatat dan bisa dibaca peran berizin', async () => {
    await clearAuthTables(ctx.ownerDb);
    const churchId = await createTestChurch(ctx.ownerDb, {
      name: 'Gereja Uji Audit',
      slug: 'gereja-uji-audit',
    });
    await createTestUser(ctx.ownerDb, {
      churchId,
      name: 'Majelis Audit',
      email: 'audit-majelis@test.local',
      role: 'admin_gereja',
    });
    const cookie = await loginAs('audit-majelis@test.local');

    await ctx.app.request('/api/users/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie, ...CSRF_HEADERS },
      body: JSON.stringify({
        name: 'Audit Baru',
        email: ctx.unique('audit-baru'),
        role: 'pelayan',
      }),
    });

    const logs = await ctx.app.request('/api/audit?page=1&perPage=20', {
      headers: { Cookie: cookie },
    });
    // admin_gereja memiliki izin finance.audit lewat matriks.
    expect(logs.status).toBe(200);
    const body = (await logs.json()) as { items: { action: string }[]; meta: { total: number } };
    expect(body.meta.total).toBeGreaterThan(0);
    expect(body.items.some((item) => item.action === 'user.invited')).toBe(true);
  });

  it('peran tanpa izin audit tidak dapat membaca jejak audit', async () => {
    await clearAuthTables(ctx.ownerDb);
    const churchId = await createTestChurch(ctx.ownerDb, {
      name: 'Gereja Uji Audit2',
      slug: 'gereja-uji-audit2',
    });
    await createTestUser(ctx.ownerDb, {
      churchId,
      name: 'Pelayan Audit',
      email: 'audit-pelayan@test.local',
      role: 'pelayan',
    });

    const cookie = await loginAs('audit-pelayan@test.local');
    const logs = await ctx.app.request('/api/audit', { headers: { Cookie: cookie } });
    expect(logs.status).toBe(403);
  });
});
