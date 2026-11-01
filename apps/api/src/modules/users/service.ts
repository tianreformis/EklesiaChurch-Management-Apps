import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { Logger } from 'pino';
import type { InviteUserInput, UpdateUserInput } from '@eklesia/shared';
import type { Database } from '../../db/client.js';
import type { TenantDb } from '../../db/tenant.js';
import { authTokens, sessions, superAdmins, users } from '../../db/schema/index.js';
import type { User } from '../../db/schema/index.js';
import type { AppConfig } from '../../lib/env.js';
import { conflict, forbidden, notFound } from '../../lib/errors.js';
import type { Mailer } from '../../lib/mailer.js';
import { createAuthToken } from '../../lib/tokens.js';
import { recordAudit } from '../audit/service.js';

export interface InviteDependencies {
  /** Koneksi sistem hanya untuk memeriksa email unik lintas gereja. */
  systemDb: Database;
  tenant: TenantDb;
  env: AppConfig;
  mailer: Mailer;
  logger: Logger;
}

export interface InviteResult {
  user: PublicUser;
  emailSent: boolean;
  inviteUrl?: string;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: User['role'];
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

const publicColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  isActive: users.isActive,
  lastLoginAt: users.lastLoginAt,
  createdAt: users.createdAt,
};

function serialize(row: {
  id: string;
  name: string;
  email: string;
  role: User['role'];
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}): PublicUser {
  return {
    ...row,
    lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listUsers(tenant: TenantDb): Promise<PublicUser[]> {
  const rows = await tenant.select(publicColumns).from(users).orderBy(asc(users.name));
  return rows.map(serialize);
}

export async function findEmailOwner(systemDb: Database, email: string): Promise<boolean> {
  const [existing] = await systemDb
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);
  if (existing) {
    return true;
  }
  const [admin] = await systemDb
    .select({ id: superAdmins.id })
    .from(superAdmins)
    .where(sql`lower(${superAdmins.email}) = ${email}`)
    .limit(1);
  return Boolean(admin);
}

/**
 * Membuat undangan bagi pengguna baru. Email harus unik lintas gereja karena
 * login hanya memakai email tanpa memilih tenant.
 */
export async function inviteUser(
  deps: InviteDependencies,
  input: InviteUserInput,
  actorId: string,
  churchName: string,
): Promise<InviteResult> {
  if (await findEmailOwner(deps.systemDb, input.email)) {
    throw conflict('Email ini sudah dipakai akun lain.');
  }

  const [created] = await deps.tenant
    .insert(users)
    .values({
      churchId: deps.tenant.churchId,
      name: input.name,
      email: input.email,
      role: input.role,
      isActive: true,
    })
    .returning(publicColumns);

  if (!created) {
    throw conflict('Pengguna gagal dibuat.');
  }

  await recordAudit(deps.tenant, {
    churchId: deps.tenant.churchId,
    userId: actorId,
    entity: 'user',
    entityId: created.id,
    action: 'user.invited',
    after: { name: created.name, role: created.role },
  });

  const invitation = await createInvitation(deps, created.id, created.email, created.name, churchName);

  return {
    user: serialize(created),
    emailSent: invitation.emailSent,
    ...(invitation.inviteUrl ? { inviteUrl: invitation.inviteUrl } : {}),
  };
}

export async function resendInvitation(
  deps: InviteDependencies,
  userId: string,
  churchName: string,
): Promise<InviteResult> {
  const [user] = await deps.tenant.select(publicColumns).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    throw notFound('Pengguna tidak ditemukan.');
  }
  if (user.isActive && user.lastLoginAt) {
    throw conflict('Pengguna ini sudah pernah masuk. Gunakan atur ulang password.');
  }

  const invitation = await createInvitation(deps, user.id, user.email, user.name, churchName);
  return {
    user: serialize(user),
    emailSent: invitation.emailSent,
    ...(invitation.inviteUrl ? { inviteUrl: invitation.inviteUrl } : {}),
  };
}

async function createInvitation(
  deps: InviteDependencies,
  userId: string,
  email: string,
  name: string,
  churchName: string,
): Promise<{ emailSent: boolean; inviteUrl?: string }> {
  const { token, tokenHash } = createAuthToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await deps.tenant.insert(authTokens).values({
    churchId: deps.tenant.churchId,
    userId,
    type: 'invitation',
    tokenHash,
    expiresAt,
  });

  const inviteUrl = `${deps.env.APP_BASE_URL.replace(/\/+$/, '')}/undangan?token=${encodeURIComponent(token)}`;

  if (!deps.mailer.isConfigured) {
    return { emailSent: false, inviteUrl };
  }

  try {
    await deps.mailer.send({
      to: email,
      subject: `Undangan bergabung di ${churchName}`,
      text: `Salam ${name},\n\nAnda diundang untuk bergabung di ${churchName} pada aplikasi ${deps.env.APP_NAME}. Buka tautan berikut untuk membuat password (berlaku 7 hari):\n${inviteUrl}\n\nBila Anda merasa tidak diundang, abaikan email ini.`,
    });
    return { emailSent: true };
  } catch (error) {
    deps.logger.error({ err: error }, 'email undangan gagal dikirim');
    return { emailSent: false, inviteUrl };
  }
}

export async function updateUser(
  deps: { systemDb: Database; tenant: TenantDb },
  actor: { id: string; role: User['role'] },
  targetId: string,
  input: UpdateUserInput,
): Promise<PublicUser> {
  const [target] = await deps.tenant.select().from(users).where(eq(users.id, targetId)).limit(1);
  if (!target) {
    throw notFound('Pengguna tidak ditemukan.');
  }
  if (target.role === 'admin_gereja') {
    throw forbidden('Akun admin gereja tidak dapat diubah dari sini.');
  }
  if (target.id === actor.id && input.isActive === false) {
    throw forbidden('Anda tidak dapat menonaktifkan akun sendiri.');
  }

  const [row] = await deps.tenant
    .update(users)
    .set({
      ...(input.name ? { name: input.name } : {}),
      ...(input.role ? { role: input.role } : {}),
      ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
      updatedAt: new Date(),
    })
    .where(eq(users.id, targetId))
    .returning(publicColumns);

  if (!row) {
    throw notFound('Pengguna tidak ditemukan.');
  }
  if (input.isActive === false) {
    await deps.tenant.delete(sessions).where(eq(sessions.userId, targetId));
  }
  await recordAudit(deps.tenant, {
    churchId: deps.tenant.churchId,
    userId: actor.id,
    entity: 'user',
    entityId: targetId,
    action: 'user.updated',
    before: { name: target.name, role: target.role, isActive: target.isActive },
    after: { name: row.name, role: row.role, isActive: row.isActive },
  });

  return serialize(row);
}

/** Dipakai saat menerima undangan: menandai undangan lama tidak terpakai lagi. */
export async function supersedeInvitations(db: Database, userId: string): Promise<void> {
  await db
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(authTokens.userId, userId), eq(authTokens.type, 'invitation'), isNull(authTokens.usedAt)));
}
