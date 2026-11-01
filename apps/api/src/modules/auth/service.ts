import { and, eq, isNull, lt, sql } from 'drizzle-orm';
import type { Logger } from 'pino';
import type { AcceptInvitationInput, LoginInput } from '@eklesia/shared';
import type { Database } from '../../db/client.js';
import { authTokens, churches, sessions, superAdmins, users } from '../../db/schema/index.js';
import type { Church, User } from '../../db/schema/index.js';
import type { AppConfig } from '../../lib/env.js';
import { badRequest, forbidden, notFound, unauthorized } from '../../lib/errors.js';
import type { Mailer } from '../../lib/mailer.js';
import { hashPassword, verifyPassword } from '../../lib/passwords.js';
import { createAuthToken, createSessionToken, hashToken } from '../../lib/tokens.js';
import type { AuthContext } from '../../types.js';
import { recordAudit } from '../audit/service.js';

export interface AuthServiceDependencies {
  db: Database;
  env: AppConfig;
  mailer: Mailer;
  logger: Logger;
}

export interface ProfileUser {
  kind: 'user';
  user: { id: string; name: string; email: string; role: User['role'] };
  church: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    plan: Church['plan'];
  };
}

export interface ProfileSuperAdmin {
  kind: 'super_admin';
  superAdmin: { id: string; name: string; email: string };
}

export type Profile = ProfileUser | ProfileSuperAdmin;

export function toProfile(auth: AuthContext): Profile {
  if (auth.kind === 'super_admin') {
    return {
      kind: 'super_admin',
      superAdmin: {
        id: auth.superAdmin.id,
        name: auth.superAdmin.name,
        email: auth.superAdmin.email,
      },
    };
  }
  return {
    kind: 'user',
    user: {
      id: auth.user.id,
      name: auth.user.name,
      email: auth.user.email,
      role: auth.user.role,
    },
    church: {
      id: auth.church.id,
      name: auth.church.name,
      slug: auth.church.slug,
      timezone: auth.church.timezone,
      plan: auth.church.plan,
    },
  };
}

function baseUrl(env: AppConfig): string {
  return env.APP_BASE_URL.replace(/\/+$/, '');
}

async function trySendMail(
  deps: AuthServiceDependencies,
  message: { to: string; subject: string; text: string },
): Promise<boolean> {
  if (!deps.mailer.isConfigured) {
    return false;
  }
  try {
    await deps.mailer.send(message);
    return true;
  } catch (error) {
    deps.logger.error({ err: error, subject: message.subject }, 'email gagal dikirim');
    return false;
  }
}

export interface LoginResult {
  token: string;
  expiresAt: Date;
  profile: Profile;
}

export async function login(
  deps: AuthServiceDependencies,
  input: LoginInput,
): Promise<LoginResult> {
  const now = new Date();
  const [row] = await deps.db
    .select({ user: users, church: churches })
    .from(users)
    .innerJoin(churches, eq(users.churchId, churches.id))
    .where(sql`lower(${users.email}) = ${input.email}`)
    .limit(1);

  if (row) {
    if (!row.user.passwordHash || !row.user.isActive) {
      throw unauthorized('Email atau password salah.');
    }
    if (row.church.status === 'suspended') {
      throw forbidden('Akun gereja ini sedang dinonaktifkan. Hubungi pengelola platform.');
    }
    const valid = await verifyPassword(row.user.passwordHash, input.password);
    if (!valid) {
      throw unauthorized('Email atau password salah.');
    }

    const session = await createSession(deps, {
      churchId: row.user.churchId,
      userId: row.user.id,
    });
    await deps.db.update(users).set({ lastLoginAt: now }).where(eq(users.id, row.user.id));
    return { ...session, profile: toProfile({ kind: 'user', user: row.user, church: row.church }) };
  }

  const [admin] = await deps.db
    .select()
    .from(superAdmins)
    .where(sql`lower(${superAdmins.email}) = ${input.email}`)
    .limit(1);

  if (!admin || !admin.isActive) {
    throw unauthorized('Email atau password salah.');
  }
  const validAdmin = await verifyPassword(admin.passwordHash, input.password);
  if (!validAdmin) {
    throw unauthorized('Email atau password salah.');
  }

  const session = await createSession(deps, { superAdminId: admin.id });
  await deps.db
    .update(superAdmins)
    .set({ lastLoginAt: now })
    .where(eq(superAdmins.id, admin.id));
  return { ...session, profile: toProfile({ kind: 'super_admin', superAdmin: admin }) };
}

export async function createSession(
  deps: AuthServiceDependencies,
  subject: { churchId?: string; userId?: string; superAdminId?: string },
): Promise<{ token: string; expiresAt: Date }> {
  const { token, tokenHash } = createSessionToken();
  const expiresAt = new Date(Date.now() + deps.env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await deps.db.insert(sessions).values({
    churchId: subject.churchId ?? null,
    userId: subject.userId ?? null,
    superAdminId: subject.superAdminId ?? null,
    tokenHash,
    expiresAt,
  });
  return { token, expiresAt };
}

export async function logout(db: Database, token: string | undefined): Promise<void> {
  if (!token) {
    return;
  }
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

export interface ManualLinkResult {
  emailSent: boolean;
  manualUrl?: string;
}

/**
 * Selalu menjawab sukses agar email tidak bisa ditebak keberadaannya. Bila SMTP
 * belum diatur, tautan dikembalikan supaya pengurus bisa mengirim manual.
 */
export async function requestPasswordReset(
  deps: AuthServiceDependencies,
  email: string,
): Promise<ManualLinkResult> {
  const [user] = await deps.db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);

  if (!user || !user.isActive) {
    return { emailSent: false };
  }

  const { token, tokenHash } = createAuthToken();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await deps.db.insert(authTokens).values({
    churchId: user.churchId,
    userId: user.id,
    type: 'password_reset',
    tokenHash,
    expiresAt,
  });

  const url = `${baseUrl(deps.env)}/atur-ulang-password?token=${encodeURIComponent(token)}`;
  const emailSent = await trySendMail(deps, {
    to: user.email,
    subject: `Atur ulang password ${deps.env.APP_NAME}`,
    text: `Salam ${user.name},\n\nKami menerima permintaan atur ulang password. Buka tautan berikut dalam 1 jam:\n${url}\n\nBila Anda tidak meminta ini, abaikan email ini.`,
  });

  return emailSent ? { emailSent } : { emailSent, manualUrl: url };
}

export async function resetPassword(
  deps: AuthServiceDependencies,
  input: { token: string; password: string },
): Promise<void> {
  const validToken = await findValidToken(deps.db, input.token, 'password_reset');
  const passwordHash = await hashPassword(input.password);

  await deps.db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, validToken.userId));
    await tx
      .update(authTokens)
      .set({ usedAt: new Date() })
      .where(eq(authTokens.id, validToken.id));
    await tx.delete(sessions).where(eq(sessions.userId, validToken.userId));
    await recordAudit(tx, {
      churchId: validToken.churchId,
      userId: validToken.userId,
      entity: 'user',
      entityId: validToken.userId,
      action: 'password.reset',
    });
  });
}

export interface InvitationInfo {
  name: string;
  email: string;
  churchName: string;
  expiresAt: string;
}

export async function getInvitationInfo(db: Database, token: string): Promise<InvitationInfo> {
  const [row] = await db
    .select({ token: authTokens, user: users, church: churches })
    .from(authTokens)
    .innerJoin(users, eq(authTokens.userId, users.id))
    .innerJoin(churches, eq(users.churchId, churches.id))
    .where(
      and(
        eq(authTokens.tokenHash, hashToken(token)),
        eq(authTokens.type, 'invitation'),
        isNull(authTokens.usedAt),
      ),
    )
    .limit(1);

  if (!row || row.token.expiresAt.getTime() < Date.now()) {
    throw notFound('Undangan tidak ditemukan atau sudah kedaluwarsa.');
  }

  return {
    name: row.user.name,
    email: row.user.email,
    churchName: row.church.name,
    expiresAt: row.token.expiresAt.toISOString(),
  };
}

export async function acceptInvitation(
  deps: AuthServiceDependencies,
  input: AcceptInvitationInput,
): Promise<LoginResult> {
  const [row] = await deps.db
    .select({ token: authTokens, user: users, church: churches })
    .from(authTokens)
    .innerJoin(users, eq(authTokens.userId, users.id))
    .innerJoin(churches, eq(users.churchId, churches.id))
    .where(
      and(
        eq(authTokens.tokenHash, hashToken(input.token)),
        eq(authTokens.type, 'invitation'),
        isNull(authTokens.usedAt),
      ),
    )
    .limit(1);

  if (!row || row.token.expiresAt.getTime() < Date.now()) {
    throw badRequest('Undangan sudah tidak berlaku. Minta admin mengirim ulang undangan.');
  }
  if (!row.user.isActive) {
    throw forbidden('Akun ini sudah dinonaktifkan. Hubungi admin gereja.');
  }
  if (row.church.status === 'suspended') {
    throw forbidden('Akun gereja ini sedang dinonaktifkan.');
  }

  const passwordHash = await hashPassword(input.password);
  const now = new Date();

  await deps.db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        passwordHash,
        name: input.name ?? row.user.name,
        updatedAt: now,
        lastLoginAt: now,
      })
      .where(eq(users.id, row.user.id));
    await tx.update(authTokens).set({ usedAt: now }).where(eq(authTokens.id, row.token.id));
    await recordAudit(tx, {
      churchId: row.user.churchId,
      userId: row.user.id,
      entity: 'user',
      entityId: row.user.id,
      action: 'invitation.accepted',
    });
  });

  const session = await createSession(deps, {
    churchId: row.user.churchId,
    userId: row.user.id,
  });

  return {
    ...session,
    profile: toProfile({ kind: 'user', user: row.user, church: row.church }),
  };
}

async function findValidToken(
  db: Database,
  token: string,
  type: 'invitation' | 'password_reset',
): Promise<{ id: string; userId: string; churchId: string }> {
  const [row] = await db
    .select()
    .from(authTokens)
    .where(
      and(
        eq(authTokens.tokenHash, hashToken(token)),
        eq(authTokens.type, type),
        isNull(authTokens.usedAt),
      ),
    )
    .limit(1);

  if (!row || row.expiresAt.getTime() < Date.now()) {
    throw badRequest('Tautan sudah tidak berlaku. Silakan minta tautan baru.');
  }
  return { id: row.id, userId: row.userId, churchId: row.churchId };
}

/** Membersihkan token kedaluwarsa; dipanggil seed/CLI bila perlu. */
export async function purgeExpiredTokens(db: Database): Promise<void> {
  await db.delete(authTokens).where(lt(authTokens.expiresAt, new Date()));
}
