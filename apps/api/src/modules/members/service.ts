import { and, asc, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import type {
  CreateFamilyInput,
  CreateGroupInput,
  CreateMemberInput,
  CreateRegionInput,
  MemberFilter,
  SetGroupMembersInput,
  UpdateFamilyInput,
  UpdateGroupInput,
  UpdateMemberInput,
  UpdateRegionInput,
} from '@eklesia/shared';
import { paginationMeta } from '@eklesia/shared';
import type { TenantDb } from '../../db/tenant.js';
import {
  families,
  groupMembers,
  groups,
  members,
  regions,
  type Family,
  type Group,
  type Member,
  type Region,
} from '../../db/schema/index.js';
import { conflict, notFound } from '../../lib/errors.js';
import { recordAudit } from '../audit/service.js';

export interface Actor {
  id: string;
}

const memberColumns = {
  id: members.id,
  familyId: members.familyId,
  regionId: members.regionId,
  fullName: members.fullName,
  nickname: members.nickname,
  gender: members.gender,
  birthDate: members.birthDate,
  phone: members.phone,
  email: members.email,
  address: members.address,
  status: members.status,
  baptismDate: members.baptismDate,
  sidiDate: members.sidiDate,
  marriageDate: members.marriageDate,
  photoUrl: members.photoUrl,
  notes: members.notes,
};

function serializeMember(row: Member) {
  return {
    ...row,
    birthDate: row.birthDate ?? null,
    baptismDate: row.baptismDate ?? null,
    sidiDate: row.sidiDate ?? null,
    marriageDate: row.marriageDate ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface MemberListItem extends ReturnType<typeof serializeMember> {
  regionName: string | null;
  groupNames: string[];
}

function toDateOrNull(value: string | undefined): string | null {
  return value ?? null;
}

/** Memastikan referensi keluarga/wilayah milik gereja yang sama bila diisi. */
async function assertReferences(
  tenant: TenantDb,
  input: { familyId?: string | null; regionId?: string | null },
): Promise<void> {
  if (input.familyId) {
    const [family] = await tenant
      .select({ id: families.id })
      .from(families)
      .where(eq(families.id, input.familyId))
      .limit(1);
    if (!family) {
      throw notFound('Keluarga tidak ditemukan.');
    }
  }
  if (input.regionId) {
    const [region] = await tenant
      .select({ id: regions.id })
      .from(regions)
      .where(eq(regions.id, input.regionId))
      .limit(1);
    if (!region) {
      throw notFound('Wilayah tidak ditemukan.');
    }
  }
}

function memberValues(input: CreateMemberInput) {
  return {
    fullName: input.fullName,
    nickname: input.nickname ?? null,
    gender: input.gender ?? null,
    birthDate: toDateOrNull(input.birthDate),
    phone: input.phone ?? null,
    email: input.email ?? null,
    address: input.address ?? null,
    status: input.status,
    familyId: input.familyId ?? null,
    regionId: input.regionId ?? null,
    baptismDate: toDateOrNull(input.baptismDate),
    sidiDate: toDateOrNull(input.sidiDate),
    marriageDate: toDateOrNull(input.marriageDate),
    notes: input.notes ?? null,
  };
}

/**
 * Mencatat anggota baru. Duplikat (nama + tanggal lahir, atau nomor HP yang
 * sama) tidak ditolak di sini karena impor massal menanganinya lewat
 * pratinjau; input manual mengembalikan 409 agar pengguna sadar.
 */
export async function createMember(
  tenant: TenantDb,
  actor: Actor,
  input: CreateMemberInput,
) {
  await assertReferences(tenant, input);

  const duplicate = await findDuplicate(tenant, {
    fullName: input.fullName,
    birthDate: input.birthDate,
    phone: input.phone,
  });
  if (duplicate) {
    throw conflict(
      `Kemungkinan duplikat dengan "${duplicate.fullName}". Gunakan impor dengan pilihan perbarui, atau ubah data yang ada.`,
    );
  }

  const [created] = await tenant
    .insert(members)
    .values({ churchId: tenant.churchId, ...memberValues(input) })
    .returning();

  if (!created) {
    throw conflict('Anggota gagal dibuat.');
  }

  await recordAudit(tenant, {
    churchId: tenant.churchId,
    userId: actor.id,
    entity: 'member',
    entityId: created.id,
    action: 'member.created',
    after: { fullName: created.fullName, status: created.status },
  });

  return serializeMember(created);
}

/**
 * Deteksi duplikat: nama sama (abaikan kapital) + tanggal lahir sama, atau
 * nomor HP sama setelah dibersihkan dari spasi/tanda.
 */
export async function findDuplicate(
  tenant: TenantDb,
  input: { fullName: string; birthDate?: string; phone?: string },
): Promise<{ id: string; fullName: string } | null> {
  const cleanedName = input.fullName.trim().toLowerCase();
  if (input.birthDate) {
    const [byNameBirth] = await tenant
      .select({ id: members.id, fullName: members.fullName })
      .from(members)
      .where(
        and(
          sql`lower(${members.fullName}) = ${cleanedName}`,
          eq(members.birthDate, input.birthDate),
        ),
      )
      .limit(1);
    if (byNameBirth) {
      return byNameBirth;
    }
  }
  if (input.phone) {
    const cleanedPhone = normalizePhone(input.phone);
    if (cleanedPhone) {
      const [byPhone] = await tenant
        .select({ id: members.id, fullName: members.fullName, phone: members.phone })
        .from(members)
        .where(sql`regexp_replace(${members.phone}, '[^0-9]', '', 'g') = ${cleanedPhone.replace(/[^0-9]/g, '')}`)
        .limit(1);
      if (byPhone) {
        return { id: byPhone.id, fullName: byPhone.fullName };
      }
    }
  }
  return null;
}

export function normalizePhone(phone: string): string | null {
  const cleaned = phone.replace(/[^0-9+]/g, '');
  return cleaned === '' ? null : cleaned;
}

export async function listMembers(tenant: TenantDb, filter: MemberFilter) {
  const offset = (filter.page - 1) * filter.perPage;
  const conditions = [];

  if (filter.search) {
    const term = `%${filter.search.trim()}%`;
    conditions.push(
      or(ilike(members.fullName, term), ilike(members.phone, term), ilike(members.email, term)),
    );
  }
  if (filter.status) {
    conditions.push(eq(members.status, filter.status));
  }
  if (filter.regionId) {
    conditions.push(eq(members.regionId, filter.regionId));
  }
  if (filter.birthMonth) {
    conditions.push(sql`extract(month from ${members.birthDate}) = ${filter.birthMonth}`);
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // groupId disaring lewat subquery ke tabel group_members.
  const groupCondition = filter.groupId
    ? sql`${members.id} in (select ${groupMembers.memberId} from ${groupMembers} where ${groupMembers.groupId} = ${filter.groupId})`
    : undefined;

  const finalWhere =
    whereClause && groupCondition
      ? and(whereClause, groupCondition)
      : (groupCondition ?? whereClause);

  const rowsPromise = (async () => {
    let query = tenant
      .select({ ...memberColumns, createdAt: members.createdAt, updatedAt: members.updatedAt })
      .from(members)
      .orderBy(asc(members.fullName))
      .limit(filter.perPage)
      .offset(offset);
    if (finalWhere) {
      query = query.where(finalWhere) as typeof query;
    }
    return query;
  })();

  const totalPromise = (async () => {
    let base = tenant.select({ total: count() }).from(members);
    if (finalWhere) {
      base = base.where(finalWhere) as typeof base;
    }
    const [row] = await base;
    return row?.total ?? 0;
  })();

  const [rows, total] = await Promise.all([rowsPromise, totalPromise]);

  // Nama wilayah untuk tampilan daftar.
  const regionIds = [...new Set(rows.map((row) => row.regionId).filter(Boolean))] as string[];
  const regionNames = new Map<string, string>();
  if (regionIds.length > 0) {
    const regionRows = await tenant
      .select({ id: regions.id, name: regions.name })
      .from(regions)
      .where(sql`${regions.id} in (${sql.join(regionIds.map((id) => sql`${id}`), sql`, `)})`);
    for (const region of regionRows) {
      regionNames.set(region.id, region.name);
    }
  }

  // Nama komisi per anggota untuk tampilan daftar.
  const memberIds = rows.map((row) => row.id);
  const groupNames = new Map<string, string[]>();
  if (memberIds.length > 0) {
    const gmRows = await tenant
      .select({ memberId: groupMembers.memberId, groupName: groups.name })
      .from(groupMembers)
      .innerJoin(groups, eq(groupMembers.groupId, groups.id))
      .where(
        sql`${groupMembers.memberId} in (${sql.join(memberIds.map((id) => sql`${id}`), sql`, `)})`,
      );
    for (const row of gmRows) {
      const list = groupNames.get(row.memberId) ?? [];
      list.push(row.groupName);
      groupNames.set(row.memberId, list);
    }
  }

  return {
    items: rows.map((row) => ({
      ...row,
      birthDate: row.birthDate ?? null,
      baptismDate: row.baptismDate ?? null,
      sidiDate: row.sidiDate ?? null,
      marriageDate: row.marriageDate ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      regionName: row.regionId ? (regionNames.get(row.regionId) ?? null) : null,
      groupNames: groupNames.get(row.id) ?? [],
    })),
    meta: paginationMeta(filter.page, filter.perPage, total),
  };
}

export async function getMember(tenant: TenantDb, id: string) {
  const [row] = await tenant.select().from(members).where(eq(members.id, id)).limit(1);
  if (!row) {
    throw notFound('Anggota tidak ditemukan.');
  }
  const [family] = row.familyId
    ? await tenant.select({ id: families.id, name: families.name }).from(families).where(eq(families.id, row.familyId)).limit(1)
    : [undefined];
  const [region] = row.regionId
    ? await tenant.select({ id: regions.id, name: regions.name }).from(regions).where(eq(regions.id, row.regionId)).limit(1)
    : [undefined];
  const memberGroups = await tenant
    .select({ id: groups.id, name: groups.name, type: groups.type })
    .from(groupMembers)
    .innerJoin(groups, eq(groupMembers.groupId, groups.id))
    .where(eq(groupMembers.memberId, id));

  return {
    ...serializeMember(row),
    family: family ?? null,
    region: region ?? null,
    groups: memberGroups,
  };
}

export async function updateMember(
  tenant: TenantDb,
  actor: Actor,
  id: string,
  input: UpdateMemberInput,
) {
  const [existing] = await tenant.select().from(members).where(eq(members.id, id)).limit(1);
  if (!existing) {
    throw notFound('Anggota tidak ditemukan.');
  }
  await assertReferences(tenant, {
    familyId: input.familyId === undefined ? undefined : input.familyId,
    regionId: input.regionId === undefined ? undefined : input.regionId,
  });

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) {
      continue;
    }
    if (key === 'birthDate' || key === 'baptismDate' || key === 'sidiDate' || key === 'marriageDate') {
      patch[key] = (value as string | undefined) ?? null;
    } else if (value === null) {
      patch[key] = null;
    } else {
      patch[key] = value;
    }
  }

  const [updated] = await tenant
    .update(members)
    .set(patch)
    .where(eq(members.id, id))
    .returning();

  if (!updated) {
    throw notFound('Anggota tidak ditemukan.');
  }

  await recordAudit(tenant, {
    churchId: tenant.churchId,
    userId: actor.id,
    entity: 'member',
    entityId: id,
    action: 'member.updated',
    before: { fullName: existing.fullName, status: existing.status },
    after: { fullName: updated.fullName, status: updated.status },
  });

  return serializeMember(updated);
}

export async function deleteMember(tenant: TenantDb, actor: Actor, id: string) {
  const [existing] = await tenant.select().from(members).where(eq(members.id, id)).limit(1);
  if (!existing) {
    throw notFound('Anggota tidak ditemukan.');
  }
  await tenant.delete(members).where(eq(members.id, id));
  await recordAudit(tenant, {
    churchId: tenant.churchId,
    userId: actor.id,
    entity: 'member',
    entityId: id,
    action: 'member.deleted',
    before: { fullName: existing.fullName },
  });
  return { ok: true as const };
}

export async function listFamilies(tenant: TenantDb) {
  const rows = await tenant.select().from(families).orderBy(asc(families.name));
  const memberCounts = await tenant
    .select({ familyId: members.familyId, total: count() })
    .from(members)
    .where(sql`${members.familyId} is not null`)
    .groupBy(members.familyId);
  const counts = new Map(memberCounts.map((row) => [row.familyId, row.total]));
  return rows.map((row: Family) => ({
    ...row,
    memberCount: row.id ? (counts.get(row.id) ?? 0) : 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function createFamily(tenant: TenantDb, actor: Actor, input: CreateFamilyInput) {
  const [created] = await tenant
    .insert(families)
    .values({ churchId: tenant.churchId, name: input.name, headMemberId: input.headMemberId ?? null })
    .returning();
  if (!created) {
    throw conflict('Keluarga gagal dibuat.');
  }
  await recordAudit(tenant, {
    churchId: tenant.churchId,
    userId: actor.id,
    entity: 'family',
    entityId: created.id,
    action: 'family.created',
    after: { name: created.name },
  });
  return created;
}

export async function updateFamily(
  tenant: TenantDb,
  actor: Actor,
  id: string,
  input: UpdateFamilyInput,
) {
  const [existing] = await tenant.select().from(families).where(eq(families.id, id)).limit(1);
  if (!existing) {
    throw notFound('Keluarga tidak ditemukan.');
  }
  const [updated] = await tenant
    .update(families)
    .set({
      ...(input.name ? { name: input.name } : {}),
      ...(input.headMemberId === undefined ? {} : { headMemberId: input.headMemberId }),
      updatedAt: new Date(),
    })
    .where(eq(families.id, id))
    .returning();
  if (!updated) {
    throw notFound('Keluarga tidak ditemukan.');
  }
  await recordAudit(tenant, {
    churchId: tenant.churchId,
    userId: actor.id,
    entity: 'family',
    entityId: id,
    action: 'family.updated',
    before: { name: existing.name },
    after: { name: updated.name },
  });
  return updated;
}

export async function deleteFamily(tenant: TenantDb, actor: Actor, id: string) {
  const [existing] = await tenant.select().from(families).where(eq(families.id, id)).limit(1);
  if (!existing) {
    throw notFound('Keluarga tidak ditemukan.');
  }
  // Anggota keluarga tetap ada, hanya lepas dari keluarga ini.
  await tenant.update(members).set({ familyId: null }).where(eq(members.familyId, id));
  await tenant.delete(families).where(eq(families.id, id));
  await recordAudit(tenant, {
    churchId: tenant.churchId,
    userId: actor.id,
    entity: 'family',
    entityId: id,
    action: 'family.deleted',
    before: { name: existing.name },
  });
  return { ok: true as const };
}

export async function listRegions(tenant: TenantDb) {
  const rows = await tenant.select().from(regions).orderBy(asc(regions.name));
  const memberCounts = await tenant
    .select({ regionId: members.regionId, total: count() })
    .from(members)
    .where(sql`${members.regionId} is not null`)
    .groupBy(members.regionId);
  const counts = new Map(memberCounts.map((row) => [row.regionId, row.total]));
  return rows.map((row: Region) => ({
    ...row,
    memberCount: row.id ? (counts.get(row.id) ?? 0) : 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function createRegion(tenant: TenantDb, actor: Actor, input: CreateRegionInput) {
  const [created] = await tenant
    .insert(regions)
    .values({ churchId: tenant.churchId, name: input.name })
    .returning();
  if (!created) {
    throw conflict('Wilayah gagal dibuat.');
  }
  await recordAudit(tenant, {
    churchId: tenant.churchId,
    userId: actor.id,
    entity: 'region',
    entityId: created.id,
    action: 'region.created',
    after: { name: created.name },
  });
  return created;
}

export async function updateRegion(
  tenant: TenantDb,
  actor: Actor,
  id: string,
  input: UpdateRegionInput,
) {
  const [updated] = await tenant
    .update(regions)
    .set({ name: input.name, updatedAt: new Date() })
    .where(eq(regions.id, id))
    .returning();
  if (!updated) {
    throw notFound('Wilayah tidak ditemukan.');
  }
  await recordAudit(tenant, {
    churchId: tenant.churchId,
    userId: actor.id,
    entity: 'region',
    entityId: id,
    action: 'region.updated',
    after: { name: updated.name },
  });
  return updated;
}

export async function deleteRegion(tenant: TenantDb, actor: Actor, id: string) {
  const [existing] = await tenant.select().from(regions).where(eq(regions.id, id)).limit(1);
  if (!existing) {
    throw notFound('Wilayah tidak ditemukan.');
  }
  await tenant.update(members).set({ regionId: null }).where(eq(members.regionId, id));
  await tenant.delete(regions).where(eq(regions.id, id));
  await recordAudit(tenant, {
    churchId: tenant.churchId,
    userId: actor.id,
    entity: 'region',
    entityId: id,
    action: 'region.deleted',
    before: { name: existing.name },
  });
  return { ok: true as const };
}

export async function listGroups(tenant: TenantDb) {
  const rows = await tenant.select().from(groups).orderBy(asc(groups.name));
  const memberCounts = await tenant
    .select({ groupId: groupMembers.groupId, total: count() })
    .from(groupMembers)
    .groupBy(groupMembers.groupId);
  const counts = new Map(memberCounts.map((row) => [row.groupId, row.total]));
  return rows.map((row: Group) => ({
    ...row,
    memberCount: counts.get(row.id) ?? 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function createGroup(tenant: TenantDb, actor: Actor, input: CreateGroupInput) {
  const [created] = await tenant
    .insert(groups)
    .values({
      churchId: tenant.churchId,
      name: input.name,
      type: input.type,
      description: input.description ?? null,
    })
    .returning();
  if (!created) {
    throw conflict('Komisi/tim gagal dibuat.');
  }
  await recordAudit(tenant, {
    churchId: tenant.churchId,
    userId: actor.id,
    entity: 'group',
    entityId: created.id,
    action: 'group.created',
    after: { name: created.name, type: created.type },
  });
  return created;
}

export async function updateGroup(
  tenant: TenantDb,
  actor: Actor,
  id: string,
  input: UpdateGroupInput,
) {
  const [existing] = await tenant.select().from(groups).where(eq(groups.id, id)).limit(1);
  if (!existing) {
    throw notFound('Komisi/tim tidak ditemukan.');
  }
  const [updated] = await tenant
    .update(groups)
    .set({
      ...(input.name ? { name: input.name } : {}),
      ...(input.type ? { type: input.type } : {}),
      ...(input.description === undefined ? {} : { description: input.description }),
      updatedAt: new Date(),
    })
    .where(eq(groups.id, id))
    .returning();
  if (!updated) {
    throw notFound('Komisi/tim tidak ditemukan.');
  }
  await recordAudit(tenant, {
    churchId: tenant.churchId,
    userId: actor.id,
    entity: 'group',
    entityId: id,
    action: 'group.updated',
    before: { name: existing.name },
    after: { name: updated.name },
  });
  return updated;
}

export async function deleteGroup(tenant: TenantDb, actor: Actor, id: string) {
  const [existing] = await tenant.select().from(groups).where(eq(groups.id, id)).limit(1);
  if (!existing) {
    throw notFound('Komisi/tim tidak ditemukan.');
  }
  await tenant.delete(groupMembers).where(eq(groupMembers.groupId, id));
  await tenant.delete(groups).where(eq(groups.id, id));
  await recordAudit(tenant, {
    churchId: tenant.churchId,
    userId: actor.id,
    entity: 'group',
    entityId: id,
    action: 'group.deleted',
    before: { name: existing.name },
  });
  return { ok: true as const };
}

export async function listGroupMembers(tenant: TenantDb, groupId: string) {
  const [group] = await tenant.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  if (!group) {
    throw notFound('Komisi/tim tidak ditemukan.');
  }
  const rows = await tenant
    .select({
      id: members.id,
      fullName: members.fullName,
      phone: members.phone,
      status: members.status,
      roleInGroup: groupMembers.roleInGroup,
    })
    .from(groupMembers)
    .innerJoin(members, eq(groupMembers.memberId, members.id))
    .where(eq(groupMembers.groupId, groupId))
    .orderBy(asc(members.fullName));
  return rows;
}

/**
 * Mengganti seluruh keanggotaan komisi/tim sekaligus. Semua ID anggota
 * diperiksa milik gereja yang sama; ID asing menghasilkan 404.
 */
export async function setGroupMembers(
  tenant: TenantDb,
  actor: Actor,
  groupId: string,
  input: SetGroupMembersInput,
) {
  const [group] = await tenant.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  if (!group) {
    throw notFound('Komisi/tim tidak ditemukan.');
  }
  if (input.memberIds.length > 0) {
    const existing = await tenant
      .select({ id: members.id })
      .from(members)
      .where(
        sql`${members.id} in (${sql.join(input.memberIds.map((id) => sql`${id}`), sql`, `)})`,
      );
    const found = new Set(existing.map((row) => row.id));
    const missing = input.memberIds.filter((id) => !found.has(id));
    if (missing.length > 0) {
      throw notFound('Sebagian anggota tidak ditemukan di gereja ini.');
    }
  }
  await tenant.delete(groupMembers).where(eq(groupMembers.groupId, groupId));
  if (input.memberIds.length > 0) {
    await tenant.insert(groupMembers).values(
      input.memberIds.map((memberId) => ({
        churchId: tenant.churchId,
        groupId,
        memberId,
      })),
    );
  }
  await recordAudit(tenant, {
    churchId: tenant.churchId,
    userId: actor.id,
    entity: 'group',
    entityId: groupId,
    action: 'group.members_set',
    after: { memberCount: input.memberIds.length },
  });
  return { memberCount: input.memberIds.length };
}

export async function addGroupMember(tenant: TenantDb, actor: Actor, groupId: string, memberId: string) {
  const [group] = await tenant.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  if (!group) {
    throw notFound('Komisi/tim tidak ditemukan.');
  }
  const [member] = await tenant.select({ id: members.id }).from(members).where(eq(members.id, memberId)).limit(1);
  if (!member) {
    throw notFound('Anggota tidak ditemukan di gereja ini.');
  }
  const [existing] = await tenant
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.memberId, memberId)))
    .limit(1);
  if (existing) {
    return { ok: true as const, duplicate: true as const };
  }
  await tenant.insert(groupMembers).values({ churchId: tenant.churchId, groupId, memberId });
  await recordAudit(tenant, {
    churchId: tenant.churchId,
    userId: actor.id,
    entity: 'group',
    entityId: groupId,
    action: 'group.member_added',
    after: { memberId },
  });
  return { ok: true as const, duplicate: false as const };
}

export async function removeGroupMember(
  tenant: TenantDb,
  actor: Actor,
  groupId: string,
  memberId: string,
) {
  await tenant
    .delete(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.memberId, memberId)));
  await recordAudit(tenant, {
    churchId: tenant.churchId,
    userId: actor.id,
    entity: 'group',
    entityId: groupId,
    action: 'group.member_removed',
    after: { memberId },
  });
  return { ok: true as const };
}

/** Ulang tahun bulan berjalan, untuk pengingat pelayanan. */
export async function listBirthdaysThisMonth(tenant: TenantDb, month: number) {
  const rows = await tenant
    .select({
      id: members.id,
      fullName: members.fullName,
      birthDate: members.birthDate,
      phone: members.phone,
    })
    .from(members)
    .where(
      and(
        eq(members.status, 'aktif'),
        sql`extract(month from ${members.birthDate}) = ${month}`,
      ),
    )
    .orderBy(desc(members.birthDate));
  return rows;
}
