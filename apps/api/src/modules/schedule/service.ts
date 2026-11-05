import { randomUUID } from 'node:crypto';
import { and, asc, eq, gte, ilike, lte, sql } from 'drizzle-orm';
import type {
  CreateAssignmentInput,
  CreateServiceInput,
  CreateServiceRoleInput,
  CreateSwapRequestInput,
  ReminderChannel,
  ServiceFilter,
  UpdateReminderTemplateInput,
  UpdateServiceInput,
  UpdateServiceRoleInput,
} from '@eklesia/shared';
import { DEFAULT_EMAIL_TEMPLATE, DEFAULT_WHATSAPP_TEMPLATE } from '@eklesia/shared';
import type { Role } from '@eklesia/shared';
import type { TenantDb } from '../../db/tenant.js';
import {
  groupMembers,
  groups,
  members,
  reminderTemplates,
  serviceAssignments,
  serviceRoles,
  services,
  swapRequests,
  users,
  type Service,
  type ServiceRole,
} from '../../db/schema/index.js';
import { conflict, forbidden, notFound } from '../../lib/errors.js';
import type { Mailer } from '../../lib/mailer.js';
import { EmailNotifier, WaLinkNotifier, renderTemplate } from '../../lib/notifier.js';
import { recordAudit } from '../audit/service.js';

export interface ScheduleActor {
  id: string;
  role: Role;
}

function serializeService(row: Service) {
  return { ...row, date: row.date ?? null };
}

function serializeRole(row: ServiceRole) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function getActorMemberId(tenant: TenantDb, userId: string): Promise<string | null> {
  const [user] = await tenant
    .select({ memberId: users.memberId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user?.memberId ?? null;
}

/** Grup yang dikoordinasi anggota ini (role_in_group = 'koordinator'). */
async function coordinatedGroupIds(tenant: TenantDb, memberId: string): Promise<Set<string>> {
  const rows = await tenant
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .where(
      and(eq(groupMembers.memberId, memberId), ilike(groupMembers.roleInGroup, 'koordinator')),
    );
  return new Set(rows.map((row) => row.groupId));
}

/**
 * Koordinator komisi hanya boleh menugaskan/menyetujui untuk peran yang
 * terikat ke komisi miliknya (aturan bisnis 5 di DESCRIPTION.md).
 */
async function assertCanAssign(
  tenant: TenantDb,
  actor: ScheduleActor,
  role: ServiceRole,
): Promise<void> {
  if (actor.role !== 'koordinator_komisi') {
    return;
  }
  const memberId = await getActorMemberId(tenant, actor.id);
  if (!memberId || !role.groupId) {
    throw forbidden('Koordinator hanya dapat menugaskan peran pada komisi miliknya.');
  }
  const coordinated = await coordinatedGroupIds(tenant, memberId);
  if (!coordinated.has(role.groupId)) {
    throw forbidden('Koordinator hanya dapat menugaskan peran pada komisi miliknya.');
  }
}

async function assertGroupExists(tenant: TenantDb, groupId: string | null | undefined): Promise<void> {
  if (!groupId) {
    return;
  }
  const [group] = await tenant.select({ id: groups.id }).from(groups).where(eq(groups.id, groupId)).limit(1);
  if (!group) {
    throw notFound('Komisi/tim tidak ditemukan.');
  }
}

export async function listRoles(tenant: TenantDb) {
  const rows = await tenant
    .select()
    .from(serviceRoles)
    .orderBy(asc(serviceRoles.sortOrder), asc(serviceRoles.name));
  return rows.map(serializeRole);
}

export async function createRole(tenant: TenantDb, actor: ScheduleActor, input: CreateServiceRoleInput) {
  await assertGroupExists(tenant, input.groupId);
  const [created] = await tenant
    .insert(serviceRoles)
    .values({
      churchId: tenant.churchId,
      name: input.name,
      groupId: input.groupId ?? null,
      sortOrder: input.sortOrder,
    })
    .returning();
  if (!created) {
    throw conflict('Peran pelayanan gagal dibuat.');
  }
  await recordAudit(tenant, {
    churchId: tenant.churchId,
    userId: actor.id,
    entity: 'service_role',
    entityId: created.id,
    action: 'service_role.created',
    after: { name: created.name },
  });
  return serializeRole(created);
}

export async function updateRole(
  tenant: TenantDb,
  actor: ScheduleActor,
  id: string,
  input: UpdateServiceRoleInput,
) {
  await assertGroupExists(tenant, input.groupId);
  const [updated] = await tenant
    .update(serviceRoles)
    .set({
      ...(input.name ? { name: input.name } : {}),
      ...(input.groupId === undefined ? {} : { groupId: input.groupId }),
      ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
      updatedAt: new Date(),
    })
    .where(eq(serviceRoles.id, id))
    .returning();
  if (!updated) {
    throw notFound('Peran pelayanan tidak ditemukan.');
  }
  await recordAudit(tenant, {
    churchId: tenant.churchId,
    userId: actor.id,
    entity: 'service_role',
    entityId: id,
    action: 'service_role.updated',
    after: { name: updated.name },
  });
  return serializeRole(updated);
}

export async function deleteRole(tenant: TenantDb, actor: ScheduleActor, id: string) {
  const [existing] = await tenant.select().from(serviceRoles).where(eq(serviceRoles.id, id)).limit(1);
  if (!existing) {
    throw notFound('Peran pelayanan tidak ditemukan.');
  }
  await tenant.delete(serviceRoles).where(eq(serviceRoles.id, id));
  await recordAudit(tenant, {
    churchId: tenant.churchId,
    userId: actor.id,
    entity: 'service_role',
    entityId: id,
    action: 'service_role.deleted',
    before: { name: existing.name },
  });
  return { ok: true as const };
}

function monthRange(month: string): { from: string; to: string } {
  const [year, mon] = month.split('-').map(Number) as [number, number];
  const lastDay = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, '0')}` };
}

export async function listServices(tenant: TenantDb, filter: ServiceFilter) {
  const range = filter.month
    ? monthRange(filter.month)
    : { from: filter.from, to: filter.to };
  const conditions = [];
  if (range.from) {
    conditions.push(gte(services.date, range.from));
  }
  if (range.to) {
    conditions.push(lte(services.date, range.to));
  }
  let query = tenant
    .select()
    .from(services)
    .orderBy(asc(services.date), asc(services.startTime));
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }
  const rows = await query;

  // Ringkasan jumlah penugasan per ibadah untuk tampilan kalender/daftar.
  const counts = new Map<string, { total: number; confirmed: number }>();
  if (rows.length > 0) {
    const ids = rows.map((row) => row.id);
    const assignmentRows = await tenant
      .select({ serviceId: serviceAssignments.serviceId, status: serviceAssignments.status })
      .from(serviceAssignments)
      .where(sql`${serviceAssignments.serviceId} in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`);
    for (const row of assignmentRows) {
      const entry = counts.get(row.serviceId) ?? { total: 0, confirmed: 0 };
      entry.total += 1;
      if (row.status === 'dikonfirmasi') {
        entry.confirmed += 1;
      }
      counts.set(row.serviceId, entry);
    }
  }

  return rows.map((row) => ({
    ...serializeService(row),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    assignmentTotal: counts.get(row.id)?.total ?? 0,
    assignmentConfirmed: counts.get(row.id)?.confirmed ?? 0,
  }));
}

export async function getService(tenant: TenantDb, id: string) {
  const [row] = await tenant.select().from(services).where(eq(services.id, id)).limit(1);
  if (!row) {
    throw notFound('Ibadah tidak ditemukan.');
  }
  const assignments = await tenant
    .select({
      id: serviceAssignments.id,
      serviceRoleId: serviceAssignments.serviceRoleId,
      roleName: serviceRoles.name,
      memberId: serviceAssignments.memberId,
      memberName: members.fullName,
      memberPhone: members.phone,
      status: serviceAssignments.status,
      notes: serviceAssignments.notes,
    })
    .from(serviceAssignments)
    .innerJoin(serviceRoles, eq(serviceAssignments.serviceRoleId, serviceRoles.id))
    .innerJoin(members, eq(serviceAssignments.memberId, members.id))
    .where(eq(serviceAssignments.serviceId, id))
    .orderBy(asc(serviceRoles.sortOrder), asc(members.fullName));

  return {
    ...serializeService(row),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    assignments,
  };
}

function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

/**
 * Membuat ibadah; `recurrenceWeeks > 1` membuat pola mingguan dengan tanggal
 * +7 hari dan satu `recurrenceId` bersama. Mengembalikan semua baris dibuat.
 */
export async function createServices(
  tenant: TenantDb,
  actor: ScheduleActor,
  input: CreateServiceInput,
) {
  const weeks = input.recurrenceWeeks;
  const recurrenceId = weeks > 1 ? randomUUID() : null;
  const created: Service[] = [];
  for (let index = 0; index < weeks; index += 1) {
    const [row] = await tenant
      .insert(services)
      .values({
        churchId: tenant.churchId,
        title: input.title,
        date: addDays(input.date, index * 7),
        startTime: input.startTime,
        endTime: input.endTime ?? null,
        location: input.location ?? null,
        theme: input.theme ?? null,
        preacher: input.preacher ?? null,
        notes: input.notes ?? null,
        recurrenceId,
      })
      .returning();
    if (row) {
      created.push(row);
    }
  }
  if (created.length === 0) {
    throw conflict('Ibadah gagal dibuat.');
  }
  await recordAudit(tenant, {
    churchId: tenant.churchId,
    userId: actor.id,
    entity: 'service',
    entityId: created[0]!.id,
    action: 'service.created',
    after: { title: input.title, occurrences: created.length },
  });
  return created.map((row) => ({
    ...serializeService(row),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function updateService(
  tenant: TenantDb,
  actor: ScheduleActor,
  id: string,
  input: UpdateServiceInput,
) {
  const [updated] = await tenant
    .update(services)
    .set({
      ...(input.title ? { title: input.title } : {}),
      ...(input.date ? { date: input.date } : {}),
      ...(input.startTime ? { startTime: input.startTime } : {}),
      ...(input.endTime === undefined ? {} : { endTime: input.endTime }),
      ...(input.location === undefined ? {} : { location: input.location ?? null }),
      ...(input.theme === undefined ? {} : { theme: input.theme ?? null }),
      ...(input.preacher === undefined ? {} : { preacher: input.preacher ?? null }),
      ...(input.notes === undefined ? {} : { notes: input.notes ?? null }),
      ...(input.status ? { status: input.status } : {}),
      updatedAt: new Date(),
    })
    .where(eq(services.id, id))
    .returning();
  if (!updated) {
    throw notFound('Ibadah tidak ditemukan.');
  }
  await recordAudit(tenant, {
    churchId: tenant.churchId,
    userId: actor.id,
    entity: 'service',
    entityId: id,
    action: 'service.updated',
    after: { title: updated.title, status: updated.status },
  });
  return {
    ...serializeService(updated),
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  };
}

export async function deleteService(tenant: TenantDb, actor: ScheduleActor, id: string) {
  const [existing] = await tenant.select().from(services).where(eq(services.id, id)).limit(1);
  if (!existing) {
    throw notFound('Ibadah tidak ditemukan.');
  }
  await tenant.delete(services).where(eq(services.id, id));
  await recordAudit(tenant, {
    churchId: tenant.churchId,
    userId: actor.id,
    entity: 'service',
    entityId: id,
    action: 'service.deleted',
    before: { title: existing.title, date: existing.date },
  });
  return { ok: true as const };
}

function overlaps(aStart: string, aEnd: string | null, bStart: string, bEnd: string | null): boolean {
  const aE = aEnd ?? '23:59';
  const bE = bEnd ?? '23:59';
  return aStart < bE && bStart < aE;
}

/**
 * Menugaskan pelayan. Bentrok (orang sama, tanggal sama, jam tumpang tindih,
 * termasuk peran lain di ibadah yang sama) dikembalikan sebagai peringatan,
 * bukan penolakan — koordinator yang memutuskan (DESCRIPTION 3.2).
 */
export async function createAssignment(
  tenant: TenantDb,
  actor: ScheduleActor,
  input: CreateAssignmentInput,
) {
  const [service] = await tenant.select().from(services).where(eq(services.id, input.serviceId)).limit(1);
  if (!service) {
    throw notFound('Ibadah tidak ditemukan.');
  }
  const [role] = await tenant.select().from(serviceRoles).where(eq(serviceRoles.id, input.serviceRoleId)).limit(1);
  if (!role) {
    throw notFound('Peran pelayanan tidak ditemukan.');
  }
  const [member] = await tenant.select().from(members).where(eq(members.id, input.memberId)).limit(1);
  if (!member) {
    throw notFound('Anggota tidak ditemukan di gereja ini.');
  }
  await assertCanAssign(tenant, actor, role);

  const [duplicate] = await tenant
    .select({ id: serviceAssignments.id })
    .from(serviceAssignments)
    .where(
      and(
        eq(serviceAssignments.serviceId, input.serviceId),
        eq(serviceAssignments.serviceRoleId, input.serviceRoleId),
        eq(serviceAssignments.memberId, input.memberId),
      ),
    )
    .limit(1);
  if (duplicate) {
    throw conflict('Anggota ini sudah ditugaskan pada peran yang sama di ibadah ini.');
  }

  const warnings: string[] = [];
  const sameDay = await tenant
    .select({
      assignmentId: serviceAssignments.id,
      serviceId: serviceAssignments.serviceId,
      roleName: serviceRoles.name,
      title: services.title,
      startTime: services.startTime,
      endTime: services.endTime,
    })
    .from(serviceAssignments)
    .innerJoin(services, eq(serviceAssignments.serviceId, services.id))
    .innerJoin(serviceRoles, eq(serviceAssignments.serviceRoleId, serviceRoles.id))
    .where(
      and(
        eq(serviceAssignments.memberId, input.memberId),
        eq(services.date, service.date),
        sql`${serviceAssignments.status} <> 'ditolak'`,
      ),
    );
  for (const row of sameDay) {
    if (overlaps(service.startTime, service.endTime, row.startTime, row.endTime)) {
      warnings.push(
        row.serviceId === service.id
          ? `${member.fullName} juga bertugas sebagai ${row.roleName} pada ibadah ini.`
          : `${member.fullName} juga bertugas sebagai ${row.roleName} pada "${row.title}" (${row.startTime}).`,
      );
    }
  }

  const [created] = await tenant
    .insert(serviceAssignments)
    .values({
      churchId: tenant.churchId,
      serviceId: input.serviceId,
      serviceRoleId: input.serviceRoleId,
      memberId: input.memberId,
      notes: input.notes ?? null,
    })
    .returning();
  if (!created) {
    throw conflict('Penugasan gagal dibuat.');
  }
  await recordAudit(tenant, {
    churchId: tenant.churchId,
    userId: actor.id,
    entity: 'service_assignment',
    entityId: created.id,
    action: 'assignment.created',
    after: { serviceId: input.serviceId, memberName: member.fullName, roleName: role.name, warnings: warnings.length },
  });
  return {
    assignment: {
      ...created,
      roleName: role.name,
      memberName: member.fullName,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    },
    warnings,
  };
}

export async function deleteAssignment(tenant: TenantDb, actor: ScheduleActor, assignmentId: string) {
  const [existing] = await tenant
    .select()
    .from(serviceAssignments)
    .where(eq(serviceAssignments.id, assignmentId))
    .limit(1);
  if (!existing) {
    throw notFound('Penugasan tidak ditemukan.');
  }
  const [role] = await tenant
    .select()
    .from(serviceRoles)
    .where(eq(serviceRoles.id, existing.serviceRoleId))
    .limit(1);
  if (role) {
    await assertCanAssign(tenant, actor, role);
  }
  await tenant.delete(serviceAssignments).where(eq(serviceAssignments.id, assignmentId));
  await recordAudit(tenant, {
    churchId: tenant.churchId,
    userId: actor.id,
    entity: 'service_assignment',
    entityId: assignmentId,
    action: 'assignment.deleted',
    before: { serviceId: existing.serviceId, memberId: existing.memberId },
  });
  return { ok: true as const };
}

/** "Jadwal saya": penugasan milik anggota yang terhubung ke akun pengguna. */
export async function listMyAssignments(tenant: TenantDb, userId: string) {
  const memberId = await getActorMemberId(tenant, userId);
  if (!memberId) {
    return { memberId: null, items: [] };
  }
  const rows = await tenant
    .select({
      id: serviceAssignments.id,
      status: serviceAssignments.status,
      notes: serviceAssignments.notes,
      serviceId: services.id,
      title: services.title,
      date: services.date,
      startTime: services.startTime,
      endTime: services.endTime,
      location: services.location,
      roleName: serviceRoles.name,
    })
    .from(serviceAssignments)
    .innerJoin(services, eq(serviceAssignments.serviceId, services.id))
    .innerJoin(serviceRoles, eq(serviceAssignments.serviceRoleId, serviceRoles.id))
    .where(eq(serviceAssignments.memberId, memberId))
    .orderBy(asc(services.date), asc(services.startTime));
  return { memberId, items: rows };
}

export async function respondAssignment(
  tenant: TenantDb,
  userId: string,
  assignmentId: string,
  status: 'dikonfirmasi' | 'ditolak',
) {
  const memberId = await getActorMemberId(tenant, userId);
  const [existing] = await tenant
    .select()
    .from(serviceAssignments)
    .where(eq(serviceAssignments.id, assignmentId))
    .limit(1);
  if (!existing || !memberId || existing.memberId !== memberId) {
    throw notFound('Penugasan tidak ditemukan.');
  }
  const [updated] = await tenant
    .update(serviceAssignments)
    .set({ status, updatedAt: new Date() })
    .where(eq(serviceAssignments.id, assignmentId))
    .returning();
  await recordAudit(tenant, {
    churchId: tenant.churchId,
    userId,
    entity: 'service_assignment',
    entityId: assignmentId,
    action: `assignment.${status}`,
    after: { status },
  });
  return updated;
}

export async function createSwapRequest(
  tenant: TenantDb,
  userId: string,
  input: CreateSwapRequestInput,
) {
  const memberId = await getActorMemberId(tenant, userId);
  const [assignment] = await tenant
    .select()
    .from(serviceAssignments)
    .where(eq(serviceAssignments.id, input.assignmentId))
    .limit(1);
  if (!assignment || !memberId || assignment.memberId !== memberId) {
    throw notFound('Penugasan tidak ditemukan.');
  }
  if (input.proposedMemberId === memberId) {
    throw conflict('Pengganti harus orang lain.');
  }
  const [proposed] = await tenant
    .select({ id: members.id })
    .from(members)
    .where(eq(members.id, input.proposedMemberId))
    .limit(1);
  if (!proposed) {
    throw notFound('Pengganti tidak ditemukan di gereja ini.');
  }
  const [pending] = await tenant
    .select({ id: swapRequests.id })
    .from(swapRequests)
    .where(
      and(
        eq(swapRequests.assignmentId, input.assignmentId),
        sql`${swapRequests.status} in ('menunggu_pengganti', 'menunggu_koordinator')`,
      ),
    )
    .limit(1);
  if (pending) {
    throw conflict('Masih ada permintaan tukar yang belum selesai untuk penugasan ini.');
  }
  const [created] = await tenant
    .insert(swapRequests)
    .values({
      churchId: tenant.churchId,
      assignmentId: input.assignmentId,
      requestedBy: memberId,
      proposedMemberId: input.proposedMemberId,
      reason: input.reason ?? null,
    })
    .returning();
  if (!created) {
    throw conflict('Permintaan tukar gagal dibuat.');
  }
  await recordAudit(tenant, {
    churchId: tenant.churchId,
    userId,
    entity: 'swap_request',
    entityId: created.id,
    action: 'swap.created',
    after: { assignmentId: input.assignmentId },
  });
  return created;
}

export async function listSwapRequests(tenant: TenantDb, actor: ScheduleActor) {
  const memberId = await getActorMemberId(tenant, actor.id);
  const rows = await tenant
    .select({
      id: swapRequests.id,
      assignmentId: swapRequests.assignmentId,
      requestedBy: swapRequests.requestedBy,
      proposedMemberId: swapRequests.proposedMemberId,
      status: swapRequests.status,
      reason: swapRequests.reason,
      createdAt: swapRequests.createdAt,
      requesterName: members.fullName,
    })
    .from(swapRequests)
    .innerJoin(members, eq(swapRequests.requestedBy, members.id))
    .orderBy(asc(swapRequests.createdAt));

  // Lengkapi nama pengganti dan konteks ibadah/peran.
  const enriched = [];
  for (const row of rows) {
    const [proposed] = await tenant
      .select({ fullName: members.fullName })
      .from(members)
      .where(eq(members.id, row.proposedMemberId))
      .limit(1);
    const [context] = await tenant
      .select({ title: services.title, date: services.date, roleName: serviceRoles.name })
      .from(serviceAssignments)
      .innerJoin(services, eq(serviceAssignments.serviceId, services.id))
      .innerJoin(serviceRoles, eq(serviceAssignments.serviceRoleId, serviceRoles.id))
      .where(eq(serviceAssignments.id, row.assignmentId))
      .limit(1);
    enriched.push({
      ...row,
      proposedName: proposed?.fullName ?? '—',
      serviceTitle: context?.title ?? '—',
      serviceDate: context?.date ?? null,
      roleName: context?.roleName ?? '—',
      createdAt: row.createdAt.toISOString(),
    });
  }

  const canApprove = actor.role === 'admin_gereja' || actor.role === 'koordinator_komisi';
  return enriched.filter((row) => {
    if (memberId && (row.requestedBy === memberId || row.proposedMemberId === memberId)) {
      return true;
    }
    return canApprove && row.status === 'menunggu_koordinator';
  });
}

export async function respondSwapRequest(
  tenant: TenantDb,
  userId: string,
  swapId: string,
  accept: boolean,
) {
  const memberId = await getActorMemberId(tenant, userId);
  const [swap] = await tenant.select().from(swapRequests).where(eq(swapRequests.id, swapId)).limit(1);
  if (!swap || !memberId || swap.proposedMemberId !== memberId) {
    throw notFound('Permintaan tukar tidak ditemukan.');
  }
  if (swap.status !== 'menunggu_pengganti') {
    throw conflict('Permintaan ini sudah dijawab.');
  }
  const [updated] = await tenant
    .update(swapRequests)
    .set({ status: accept ? 'menunggu_koordinator' : 'ditolak', updatedAt: new Date() })
    .where(eq(swapRequests.id, swapId))
    .returning();
  await recordAudit(tenant, {
    churchId: tenant.churchId,
    userId,
    entity: 'swap_request',
    entityId: swapId,
    action: accept ? 'swap.replacement_accepted' : 'swap.replacement_rejected',
  });
  return updated;
}

export async function approveSwapRequest(
  tenant: TenantDb,
  actor: ScheduleActor,
  swapId: string,
  accept: boolean,
) {
  const [swap] = await tenant.select().from(swapRequests).where(eq(swapRequests.id, swapId)).limit(1);
  if (!swap) {
    throw notFound('Permintaan tukar tidak ditemukan.');
  }
  if (swap.status !== 'menunggu_koordinator') {
    throw conflict('Permintaan ini belum siap diputuskan koordinator.');
  }
  const [assignment] = await tenant
    .select()
    .from(serviceAssignments)
    .where(eq(serviceAssignments.id, swap.assignmentId))
    .limit(1);
  if (!assignment) {
    throw notFound('Penugasan tidak ditemukan.');
  }
  const [role] = await tenant
    .select()
    .from(serviceRoles)
    .where(eq(serviceRoles.id, assignment.serviceRoleId))
    .limit(1);
  if (role) {
    await assertCanAssign(tenant, actor, role);
  }

  if (accept) {
    // Ganti pelayan dan minta konfirmasi ulang dari pengganti.
    await tenant
      .update(serviceAssignments)
      .set({ memberId: swap.proposedMemberId, status: 'menunggu', updatedAt: new Date() })
      .where(eq(serviceAssignments.id, swap.assignmentId));
  }
  const [updated] = await tenant
    .update(swapRequests)
    .set({ status: accept ? 'disetujui' : 'ditolak', resolvedBy: actor.id, updatedAt: new Date() })
    .where(eq(swapRequests.id, swapId))
    .returning();
  await recordAudit(tenant, {
    churchId: tenant.churchId,
    userId: actor.id,
    entity: 'swap_request',
    entityId: swapId,
    action: accept ? 'swap.approved' : 'swap.rejected',
  });
  return updated;
}

export async function cancelSwapRequest(tenant: TenantDb, userId: string, swapId: string) {
  const memberId = await getActorMemberId(tenant, userId);
  const [swap] = await tenant.select().from(swapRequests).where(eq(swapRequests.id, swapId)).limit(1);
  if (!swap || !memberId || swap.requestedBy !== memberId) {
    throw notFound('Permintaan tukar tidak ditemukan.');
  }
  if (swap.status !== 'menunggu_pengganti' && swap.status !== 'menunggu_koordinator') {
    throw conflict('Permintaan ini sudah selesai.');
  }
  const [updated] = await tenant
    .update(swapRequests)
    .set({ status: 'dibatalkan', updatedAt: new Date() })
    .where(eq(swapRequests.id, swapId))
    .returning();
  return updated;
}

export async function listTemplates(tenant: TenantDb) {
  const existing = await tenant.select().from(reminderTemplates);
  const byChannel = new Map(existing.map((row) => [row.channel, row]));
  const result: { channel: ReminderChannel; body: string }[] = [];
  for (const channel of ['whatsapp', 'email'] as ReminderChannel[]) {
    const found = byChannel.get(channel);
    if (found) {
      result.push({ channel, body: found.body });
    } else {
      const body = channel === 'whatsapp' ? DEFAULT_WHATSAPP_TEMPLATE : DEFAULT_EMAIL_TEMPLATE;
      await tenant.insert(reminderTemplates).values({ churchId: tenant.churchId, channel, body });
      result.push({ channel, body });
    }
  }
  return result;
}

export async function updateTemplate(
  tenant: TenantDb,
  actor: ScheduleActor,
  channel: ReminderChannel,
  input: UpdateReminderTemplateInput,
) {
  await listTemplates(tenant);
  const [updated] = await tenant
    .update(reminderTemplates)
    .set({ body: input.body, updatedAt: new Date() })
    .where(eq(reminderTemplates.channel, channel))
    .returning();
  await recordAudit(tenant, {
    churchId: tenant.churchId,
    userId: actor.id,
    entity: 'reminder_template',
    entityId: updated?.id ?? null,
    action: 'reminder_template.updated',
    after: { channel },
  });
  return { channel, body: input.body };
}

export interface ReminderItem {
  assignmentId: string;
  memberName: string;
  roleName: string;
  phone: string | null;
  email: string | null;
  waLink: string | null;
  emailSent: boolean;
  message: string;
}

/**
 * Menyiapkan pengingat untuk semua pelayan pada satu ibadah. Tautan WhatsApp
 * selalu dibuat (pengurus yang mengklik/kirim); email hanya dikirim bila
 * diminta dan SMTP terkonfigurasi.
 */
export async function remindService(
  tenant: TenantDb,
  actor: ScheduleActor,
  serviceId: string,
  sendEmail: boolean,
  mailer: Mailer,
) {
  const [service] = await tenant.select().from(services).where(eq(services.id, serviceId)).limit(1);
  if (!service) {
    throw notFound('Ibadah tidak ditemukan.');
  }
  const templates = await listTemplates(tenant);
  const whatsappBody = templates.find((t) => t.channel === 'whatsapp')?.body ?? DEFAULT_WHATSAPP_TEMPLATE;
  const emailBody = templates.find((t) => t.channel === 'email')?.body ?? DEFAULT_EMAIL_TEMPLATE;

  const assignments = await tenant
    .select({
      id: serviceAssignments.id,
      memberName: members.fullName,
      phone: members.phone,
      email: members.email,
      roleName: serviceRoles.name,
    })
    .from(serviceAssignments)
    .innerJoin(members, eq(serviceAssignments.memberId, members.id))
    .innerJoin(serviceRoles, eq(serviceAssignments.serviceRoleId, serviceRoles.id))
    .where(
      and(
        eq(serviceAssignments.serviceId, serviceId),
        sql`${serviceAssignments.status} <> 'ditolak'`,
      ),
    );

  const wa = new WaLinkNotifier();
  const emailer = new EmailNotifier(mailer);
  const items: ReminderItem[] = [];
  for (const row of assignments) {
    const context = {
      nama: row.memberName,
      peran: row.roleName,
      ibadah: service.title,
      tanggal: service.date,
      jam: service.startTime,
      lokasi: service.location ?? '-',
    };
    const waResult = await wa.prepare({ phone: row.phone, email: row.email, text: renderTemplate(whatsappBody, context) });
    let emailSent = false;
    if (sendEmail) {
      const emailResult = await emailer.prepare({
        phone: row.phone,
        email: row.email,
        text: renderTemplate(emailBody, context),
      });
      emailSent = emailResult.emailSent;
    }
    items.push({
      assignmentId: row.id,
      memberName: row.memberName,
      roleName: row.roleName,
      phone: row.phone,
      email: row.email,
      waLink: waResult.waLink,
      emailSent,
      message: renderTemplate(whatsappBody, context),
    });
  }

  await recordAudit(tenant, {
    churchId: tenant.churchId,
    userId: actor.id,
    entity: 'service',
    entityId: serviceId,
    action: 'service.reminded',
    after: { recipients: items.length, sendEmail },
  });
  return { serviceId, items };
}
