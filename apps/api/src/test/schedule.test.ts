import { eq } from 'drizzle-orm';
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
import { groupMembers, groups, members, users } from '../db/schema/index.js';

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

function csrfJson(cookie: string, body: unknown, method = 'POST'): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookie, ...CSRF_HEADERS },
    body: JSON.stringify(body),
  };
}

interface Seeded {
  churchA: string;
  adminA: string;
  adminB: string;
  sekretaris: string;
  majelis: string;
  memberA: string;
  memberB: string;
  pelayanA: string;
  pelayanB: string;
  groupMusik: string;
  koordinator: string;
  memberKoord: string;
}

/** Menyiapkan gereja A lengkap: anggota, komisi musik + koordinatornya, akun terkait. */
async function seed(): Promise<Seeded> {
  await clearAuthTables(ctx.ownerDb);
  const churchA = await createTestChurch(ctx.ownerDb, { name: 'Gereja Jadwal A', slug: 'gereja-jadwal-a' });
  const churchB = await createTestChurch(ctx.ownerDb, { name: 'Gereja Jadwal B', slug: 'gereja-jadwal-b' });

  // Anggota dan komisi disiapkan langsung di DB (jalur API jemaat diuji di Fase 2).
  const [groupMusik] = await ctx.ownerDb
    .insert(groups)
    .values({ churchId: churchA, name: 'Tim Musik', type: 'tim_pelayanan' })
    .returning({ id: groups.id });
  const insertMember = async (fullName: string, phone: string) => {
    const [row] = await ctx.ownerDb
      .insert(members)
      .values({ churchId: churchA, fullName, phone, status: 'aktif' })
      .returning({ id: members.id });
    return row!.id;
  };
  const memberA = await insertMember('Pelayan Satu', '081211110001');
  const memberB = await insertMember('Pelayan Dua', '081211110002');
  const memberKoord = await insertMember('Koordinator Musik', '081211110003');
  await ctx.ownerDb.insert(groupMembers).values([
    { churchId: churchA, groupId: groupMusik!.id, memberId: memberKoord, roleInGroup: 'koordinator' },
    { churchId: churchA, groupId: groupMusik!.id, memberId: memberA },
    { churchId: churchA, groupId: groupMusik!.id, memberId: memberB },
  ]);

  const adminUser = await createTestUser(ctx.ownerDb, {
    churchId: churchA, name: 'Admin A', email: ctx.unique('admin-jadwal'), role: 'admin_gereja',
  });
  const adminBUser = await createTestUser(ctx.ownerDb, {
    churchId: churchB, name: 'Admin B', email: ctx.unique('admin-jadwal-b'), role: 'admin_gereja',
  });
  const sekretarisUser = await createTestUser(ctx.ownerDb, {
    churchId: churchA, name: 'Sekretaris', email: ctx.unique('sekretaris'), role: 'sekretaris',
  });
  const majelisUser = await createTestUser(ctx.ownerDb, {
    churchId: churchA, name: 'Majelis', email: ctx.unique('majelis-jadwal'), role: 'majelis',
  });
  const pelayanAUser = await createTestUser(ctx.ownerDb, {
    churchId: churchA, name: 'Akun Pelayan Satu', email: ctx.unique('pelayan-a'), role: 'pelayan',
  });
  const pelayanBUser = await createTestUser(ctx.ownerDb, {
    churchId: churchA, name: 'Akun Pelayan Dua', email: ctx.unique('pelayan-b'), role: 'pelayan',
  });
  const koordUser = await createTestUser(ctx.ownerDb, {
    churchId: churchA, name: 'Akun Koordinator', email: ctx.unique('koord'), role: 'koordinator_komisi',
  });

  // Tautkan akun pelayan/koordinator ke data anggota.
  const link = async (email: string, memberId: string) => {
    await ctx.ownerDb.update(users).set({ memberId }).where(eq(users.email, email));
  };
  await link(pelayanAUser.email, memberA);
  await link(pelayanBUser.email, memberB);
  await link(koordUser.email, memberKoord);

  return {
    churchA,
    adminA: await loginAs(adminUser.email),
    adminB: await loginAs(adminBUser.email),
    sekretaris: await loginAs(sekretarisUser.email),
    majelis: await loginAs(majelisUser.email),
    memberA,
    memberB,
    pelayanA: await loginAs(pelayanAUser.email),
    pelayanB: await loginAs(pelayanBUser.email),
    groupMusik: groupMusik!.id,
    koordinator: await loginAs(koordUser.email),
    memberKoord,
  };
}

async function createRoleAndService(s: Seeded) {
  const roleRes = await ctx.app.request(
    '/api/schedule/roles',
    csrfJson(s.sekretaris, { name: 'Pemusik', groupId: s.groupMusik, sortOrder: 1 }),
  );
  expect(roleRes.status).toBe(201);
  const role = (await roleRes.json()) as { id: string };

  const serviceRes = await ctx.app.request(
    '/api/schedule/services',
    csrfJson(s.sekretaris, {
      title: 'Ibadah Minggu Pagi',
      date: '2026-11-08',
      startTime: '09:00',
      endTime: '11:00',
      location: 'Gedung Utama',
    }),
  );
  expect(serviceRes.status).toBe(201);
  const services = (await serviceRes.json()) as { items: { id: string }[] };
  return { roleId: role.id, serviceId: services.items[0]!.id };
}

describe('modul jadwal pelayanan (Fase 3)', () => {
  it('CRUD peran dan ibadah berulang mingguan', async () => {
    const s = await seed();

    const badRole = await ctx.app.request('/api/schedule/roles', csrfJson(s.majelis, { name: 'Usher' }));
    expect(badRole.status).toBe(403);

    const recurring = await ctx.app.request(
      '/api/schedule/services',
      csrfJson(s.sekretaris, {
        title: 'Ibadah Minggu',
        date: '2026-11-01',
        startTime: '09:00',
        recurrenceWeeks: 4,
      }),
    );
    expect(recurring.status).toBe(201);
    const body = (await recurring.json()) as { items: { date: string; recurrenceId: string | null }[] };
    expect(body.items.length).toBe(4);
    expect(body.items.map((item) => item.date)).toEqual([
      '2026-11-01',
      '2026-11-08',
      '2026-11-15',
      '2026-11-22',
    ]);
    expect(body.items[0]!.recurrenceId).toBeTruthy();
    expect(body.items[0]!.recurrenceId).toBe(body.items[3]!.recurrenceId);

    const november = await ctx.app.request('/api/schedule/services?month=2026-11', {
      headers: { Cookie: s.majelis },
    });
    const novemberBody = (await november.json()) as { items: unknown[] };
    expect(novemberBody.items.length).toBe(4);

    const desember = await ctx.app.request('/api/schedule/services?month=2026-12', {
      headers: { Cookie: s.majelis },
    });
    const desemberBody = (await desember.json()) as { items: unknown[] };
    expect(desemberBody.items.length).toBe(0);
  });

  it('penugasan memberi peringatan bentrok dan menolak duplikat persis', async () => {
    const s = await seed();
    const { roleId, serviceId } = await createRoleAndService(s);

    const first = await ctx.app.request(
      '/api/schedule/assignments',
      csrfJson(s.sekretaris, { serviceId, serviceRoleId: roleId, memberId: s.memberA }),
    );
    expect(first.status).toBe(201);
    const firstBody = (await first.json()) as { warnings: string[] };
    expect(firstBody.warnings).toEqual([]);

    const duplicate = await ctx.app.request(
      '/api/schedule/assignments',
      csrfJson(s.sekretaris, { serviceId, serviceRoleId: roleId, memberId: s.memberA }),
    );
    expect(duplicate.status).toBe(409);

    // Ibadah lain di tanggal dan jam yang tumpang tindih.
    const other = await ctx.app.request(
      '/api/schedule/services',
      csrfJson(s.sekretaris, {
        title: 'Latihan Gabungan',
        date: '2026-11-08',
        startTime: '10:00',
        endTime: '12:00',
      }),
    );
    const otherBody = (await other.json()) as { items: { id: string }[] };
    const conflict = await ctx.app.request(
      '/api/schedule/assignments',
      csrfJson(s.sekretaris, {
        serviceId: otherBody.items[0]!.id,
        serviceRoleId: roleId,
        memberId: s.memberA,
      }),
    );
    expect(conflict.status).toBe(201);
    const conflictBody = (await conflict.json()) as { warnings: string[] };
    expect(conflictBody.warnings.length).toBeGreaterThan(0);
    expect(conflictBody.warnings[0]).toContain('Pelayan Satu');

    // Majelis tidak boleh menugaskan.
    const forbiddenAssign = await ctx.app.request(
      '/api/schedule/assignments',
      csrfJson(s.majelis, { serviceId, serviceRoleId: roleId, memberId: s.memberB }),
    );
    expect(forbiddenAssign.status).toBe(403);
  });

  it('jadwal saya: pelayan mengonfirmasi penugasannya sendiri saja', async () => {
    const s = await seed();
    const { roleId, serviceId } = await createRoleAndService(s);
    await ctx.app.request(
      '/api/schedule/assignments',
      csrfJson(s.sekretaris, { serviceId, serviceRoleId: roleId, memberId: s.memberA }),
    );

    const mine = await ctx.app.request('/api/schedule/mine', { headers: { Cookie: s.pelayanA } });
    const mineBody = (await mine.json()) as { memberId: string | null; items: { id: string; status: string }[] };
    expect(mineBody.memberId).toBe(s.memberA);
    expect(mineBody.items.length).toBe(1);
    const assignmentId = mineBody.items[0]!.id;

    // Pelayan lain tidak bisa menjawab penugasan ini.
    const otherRespond = await ctx.app.request(
      `/api/schedule/assignments/${assignmentId}/respond`,
      csrfJson(s.pelayanB, { status: 'dikonfirmasi' }, 'PATCH'),
    );
    expect(otherRespond.status).toBe(404);

    const respond = await ctx.app.request(
      `/api/schedule/assignments/${assignmentId}/respond`,
      csrfJson(s.pelayanA, { status: 'dikonfirmasi' }, 'PATCH'),
    );
    expect(respond.status).toBe(200);
    const respondBody = (await respond.json()) as { status: string };
    expect(respondBody.status).toBe('dikonfirmasi');
  });

  it('alur tukar: pengganti menyetujui, koordinator komisi menyetujui, penugasan berpindah', async () => {
    const s = await seed();
    const { roleId, serviceId } = await createRoleAndService(s);
    const assign = await ctx.app.request(
      '/api/schedule/assignments',
      csrfJson(s.sekretaris, { serviceId, serviceRoleId: roleId, memberId: s.memberA }),
    );
    const assignBody = (await assign.json()) as { assignment: { id: string } };
    const assignmentId = assignBody.assignment.id;

    const swap = await ctx.app.request(
      '/api/schedule/swaps',
      csrfJson(s.pelayanA, { assignmentId, proposedMemberId: s.memberB, reason: 'Ada keperluan keluarga' }),
    );
    expect(swap.status).toBe(201);
    const swapBody = (await swap.json()) as { id: string; status: string };
    expect(swapBody.status).toBe('menunggu_pengganti');

    // Pengganti menyetujui.
    const respond = await ctx.app.request(
      `/api/schedule/swaps/${swapBody.id}/respond`,
      csrfJson(s.pelayanB, { accept: true }),
    );
    expect(respond.status).toBe(200);
    const respondBody = (await respond.json()) as { status: string };
    expect(respondBody.status).toBe('menunggu_koordinator');

    // Koordinator komisi musik menyetujui (peran terikat komisinya).
    const approve = await ctx.app.request(
      `/api/schedule/swaps/${swapBody.id}/approve`,
      csrfJson(s.koordinator, { accept: true }),
    );
    expect(approve.status).toBe(200);
    const approveBody = (await approve.json()) as { status: string };
    expect(approveBody.status).toBe('disetujui');

    // Penugasan kini milik Pelayan Dua dengan status menunggu konfirmasi ulang.
    const mineB = await ctx.app.request('/api/schedule/mine', { headers: { Cookie: s.pelayanB } });
    const mineBBody = (await mineB.json()) as { items: { id: string; status: string }[] };
    expect(mineBBody.items.map((item) => item.id)).toContain(assignmentId);
    expect(mineBBody.items.find((item) => item.id === assignmentId)?.status).toBe('menunggu');

    const mineA = await ctx.app.request('/api/schedule/mine', { headers: { Cookie: s.pelayanA } });
    const mineABody = (await mineA.json()) as { items: unknown[] };
    expect(mineABody.items.length).toBe(0);
  });

  it('koordinator komisi lain tidak dapat menyetujui tukar di luar komisinya', async () => {
    const s = await seed();
    const { roleId, serviceId } = await createRoleAndService(s);

    // Koordinator kedua untuk komisi berbeda.
    const [groupLain] = await ctx.ownerDb
      .insert(groups)
      .values({ churchId: s.churchA, name: 'Tim Multimedia', type: 'tim_pelayanan' })
      .returning({ id: groups.id });
    const [memberKoord2] = await ctx.ownerDb
      .insert(members)
      .values({ churchId: s.churchA, fullName: 'Koordinator Multimedia', status: 'aktif' })
      .returning({ id: members.id });
    await ctx.ownerDb.insert(groupMembers).values({
      churchId: s.churchA,
      groupId: groupLain!.id,
      memberId: memberKoord2!.id,
      roleInGroup: 'koordinator',
    });
    const koord2User = await createTestUser(ctx.ownerDb, {
      churchId: s.churchA, name: 'Akun Koord 2', email: ctx.unique('koord2'), role: 'koordinator_komisi',
    });
    await ctx.ownerDb.update(users).set({ memberId: memberKoord2!.id }).where(eq(users.email, koord2User.email));
    const koord2 = await loginAs(koord2User.email);

    const assign = await ctx.app.request(
      '/api/schedule/assignments',
      csrfJson(s.sekretaris, { serviceId, serviceRoleId: roleId, memberId: s.memberA }),
    );
    const assignmentId = ((await assign.json()) as { assignment: { id: string } }).assignment.id;
    const swap = await ctx.app.request(
      '/api/schedule/swaps',
      csrfJson(s.pelayanA, { assignmentId, proposedMemberId: s.memberB }),
    );
    const swapId = ((await swap.json()) as { id: string }).id;
    await ctx.app.request(`/api/schedule/swaps/${swapId}/respond`, csrfJson(s.pelayanB, { accept: true }));

    const approveOther = await ctx.app.request(
      `/api/schedule/swaps/${swapId}/approve`,
      csrfJson(koord2, { accept: true }),
    );
    expect(approveOther.status).toBe(403);

    // Koordinator yang benar tetap bisa.
    const approveRight = await ctx.app.request(
      `/api/schedule/swaps/${swapId}/approve`,
      csrfJson(s.koordinator, { accept: true }),
    );
    expect(approveRight.status).toBe(200);
  });

  it('pengingat menghasilkan tautan wa.me dan PDF bulanan dapat diunduh', async () => {
    const s = await seed();
    const { roleId, serviceId } = await createRoleAndService(s);
    await ctx.app.request(
      '/api/schedule/assignments',
      csrfJson(s.sekretaris, { serviceId, serviceRoleId: roleId, memberId: s.memberA }),
    );

    const remindForbidden = await ctx.app.request(
      `/api/schedule/services/${serviceId}/remind`,
      csrfJson(s.majelis, { sendEmail: false }),
    );
    expect(remindForbidden.status).toBe(403);

    const remind = await ctx.app.request(
      `/api/schedule/services/${serviceId}/remind`,
      csrfJson(s.sekretaris, { sendEmail: false }),
    );
    expect(remind.status).toBe(200);
    const remindBody = (await remind.json()) as {
      items: { memberName: string; waLink: string | null; message: string }[];
    };
    expect(remindBody.items.length).toBe(1);
    expect(remindBody.items[0]!.waLink).toContain('https://wa.me/6281211110001');
    expect(remindBody.items[0]!.message).toContain('Pelayan Satu');

    const templates = await ctx.app.request('/api/schedule/templates', { headers: { Cookie: s.sekretaris } });
    const templatesBody = (await templates.json()) as { items: { channel: string }[] };
    expect(templatesBody.items.map((item) => item.channel)).toEqual(['whatsapp', 'email']);

    const pdf = await ctx.app.request('/api/schedule/monthly.pdf?month=2026-11', {
      headers: { Cookie: s.majelis },
    });
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get('content-type')).toContain('application/pdf');
    const pdfBytes = new Uint8Array(await pdf.arrayBuffer());
    expect(pdfBytes.length).toBeGreaterThan(500);
    expect(String.fromCharCode(...pdfBytes.slice(0, 4))).toBe('%PDF');
  });

  it('isolasi tenant: gereja B tidak melihat ibadah gereja A', async () => {
    const s = await seed();
    const { serviceId } = await createRoleAndService(s);

    const crossRead = await ctx.app.request(`/api/schedule/services/${serviceId}`, {
      headers: { Cookie: s.adminB },
    });
    expect(crossRead.status).toBe(404);

    const listB = await ctx.app.request('/api/schedule/services?month=2026-11', {
      headers: { Cookie: s.adminB },
    });
    const listBBody = (await listB.json()) as { items: unknown[] };
    expect(listBBody.items.length).toBe(0);

    const crossAssign = await ctx.app.request(
      '/api/schedule/assignments',
      csrfJson(s.adminB, { serviceId, serviceRoleId: '00000000-0000-0000-0000-000000000000', memberId: s.memberA }),
    );
    expect([404, 400]).toContain(crossAssign.status);
  });
});
