import { desc, eq, sql } from 'drizzle-orm';
import type { Logger } from 'pino';
import type { CreateChurchInput, UpdateChurchStatusInput } from '@eklesia/shared';
import type { Database } from '../../db/client.js';
import type { AppConfig } from '../../lib/env.js';
import { authTokens, churches, superAdmins, users } from '../../db/schema/index.js';
import type { Church } from '../../db/schema/index.js';
import { conflict, notFound } from '../../lib/errors.js';
import type { Mailer } from '../../lib/mailer.js';
import { createAuthToken } from '../../lib/tokens.js';
import { recordAudit } from '../audit/service.js';

export interface PlatformChurch {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  status: Church['status'];
  plan: Church['plan'];
  createdAt: string;
  userCount: number;
}

export interface PlatformServiceDependencies {
  db: Database;
  env: AppConfig;
  mailer: Mailer;
  logger: Logger;
}

/** Daftar gereja untuk pemilik platform. Tidak memuat data jemaat/keuangan. */
export async function listChurches(db: Database): Promise<PlatformChurch[]> {
  const rows = await db
    .select({
      id: churches.id,
      name: churches.name,
      slug: churches.slug,
      address: churches.address,
      phone: churches.phone,
      status: churches.status,
      plan: churches.plan,
      createdAt: churches.createdAt,
      userCount: sql<number>`(select count(*) from ${users} where ${users.churchId} = ${churches.id})::int`,
    })
    .from(churches)
    .orderBy(desc(churches.createdAt));

  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}

export interface CreateChurchResult {
  church: PlatformChurch;
  emailSent: boolean;
  inviteUrl?: string;
}

export async function createChurch(
  deps: PlatformServiceDependencies,
  input: CreateChurchInput,
): Promise<CreateChurchResult> {
  const [sameSlug] = await deps.db
    .select({ id: churches.id })
    .from(churches)
    .where(eq(churches.slug, input.slug))
    .limit(1);
  if (sameSlug) {
    throw conflict('Slug gereja sudah dipakai.');
  }

  const [emailOwner] = await deps.db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${input.adminEmail}`)
    .limit(1);
  const [adminOwner] = await deps.db
    .select({ id: superAdmins.id })
    .from(superAdmins)
    .where(sql`lower(${superAdmins.email}) = ${input.adminEmail}`)
    .limit(1);
  if (emailOwner || adminOwner) {
    throw conflict('Email admin sudah dipakai akun lain.');
  }

  const { token, tokenHash } = createAuthToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const created = await deps.db.transaction(async (tx) => {
    const [church] = await tx
      .insert(churches)
      .values({
        name: input.name,
        slug: input.slug,
        address: input.address ?? null,
        phone: input.phone ?? null,
        plan: 'free',
        status: 'active',
      })
      .returning();
    if (!church) {
      throw conflict('Gereja gagal dibuat.');
    }

    const [admin] = await tx
      .insert(users)
      .values({
        churchId: church.id,
        name: input.adminName,
        email: input.adminEmail,
        role: 'admin_gereja',
        isActive: true,
      })
      .returning({ id: users.id });
    if (!admin) {
      throw conflict('Admin gereja gagal dibuat.');
    }

    await tx.insert(authTokens).values({
      churchId: church.id,
      userId: admin.id,
      type: 'invitation',
      tokenHash,
      expiresAt,
    });

    await recordAudit(tx, {
      churchId: church.id,
      userId: null,
      entity: 'church',
      entityId: church.id,
      action: 'church.created',
      after: { name: church.name, slug: church.slug, adminId: admin.id },
    });

    return church;
  });

  const inviteUrl = `${deps.env.APP_BASE_URL.replace(/\/+$/, '')}/undangan?token=${encodeURIComponent(token)}`;
  let emailSent = false;
  if (deps.mailer.isConfigured) {
    try {
      await deps.mailer.send({
        to: input.adminEmail,
        subject: `Undangan admin ${input.name}`,
        text: `Salam ${input.adminName},\n\nGereja ${input.name} sudah terdaftar di ${deps.env.APP_NAME}. Buka tautan berikut untuk membuat password admin (berlaku 7 hari):\n${inviteUrl}`,
      });
      emailSent = true;
    } catch (error) {
      deps.logger.error({ err: error }, 'email undangan admin gagal dikirim');
    }
  }

  const allChurches = await listChurches(deps.db);
  const church = allChurches.find((item) => item.id === created.id);
  if (!church) {
    throw notFound('Gereja tidak ditemukan setelah dibuat.');
  }

  return { church, emailSent, ...(emailSent ? {} : { inviteUrl }) };
}

export async function updateChurchStatus(
  deps: PlatformServiceDependencies,
  churchId: string,
  input: UpdateChurchStatusInput,
): Promise<PlatformChurch> {
  const [before] = await deps.db.select().from(churches).where(eq(churches.id, churchId)).limit(1);
  if (!before) {
    throw notFound('Gereja tidak ditemukan.');
  }

  await deps.db
    .update(churches)
    .set({
      status: input.status,
      ...(input.plan ? { plan: input.plan } : {}),
      updatedAt: new Date(),
    })
    .where(eq(churches.id, churchId));

  await recordAudit(deps.db, {
    churchId,
    userId: null,
    entity: 'church',
    entityId: churchId,
    action: 'church.status_changed',
    before: { status: before.status, plan: before.plan },
    after: { status: input.status, plan: input.plan ?? before.plan },
  });

  const all = await listChurches(deps.db);
  const updated = all.find((item) => item.id === churchId);
  if (!updated) {
    throw notFound('Gereja tidak ditemukan.');
  }
  return updated;
}

export interface PlatformSummary {
  totalChurches: number;
  activeChurches: number;
  suspendedChurches: number;
  totalUsers: number;
}

export async function getSummary(db: Database): Promise<PlatformSummary> {
  const [churchCounts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${churches.status} = 'active')::int`,
      suspended: sql<number>`count(*) filter (where ${churches.status} = 'suspended')::int`,
    })
    .from(churches);
  const [userCount] = await db.select({ total: sql<number>`count(*)::int` }).from(users);

  return {
    totalChurches: churchCounts?.total ?? 0,
    activeChurches: churchCounts?.active ?? 0,
    suspendedChurches: churchCounts?.suspended ?? 0,
    totalUsers: userCount?.total ?? 0,
  };
}
