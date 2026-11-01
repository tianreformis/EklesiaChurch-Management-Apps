import { eq, sql } from 'drizzle-orm';
import { createApp, type AppDependencies } from '../app.js';
import { createDatabase, type Database } from '../db/client.js';
import type { AppConfig } from '../lib/env.js';
import { createLogger } from '../lib/logger.js';
import { createMailer } from '../lib/mailer.js';
import { hashPassword } from '../lib/passwords.js';
import { churches, users } from '../db/schema/index.js';
import type { Role } from '@eklesia/shared';
import { testAppUrl, testOwnerUrl } from './setup.js';

export interface TestAccount {
  email: string;
  password: string;
  churchSlug: string;
  role: Role;
  churchId: string;
}

const logger = createLogger({
  level: 'silent',
  appName: 'Eklesia',
  destination: { write() {} },
});

const env: AppConfig = {
  APP_NAME: 'Eklesia',
  APP_BASE_URL: 'http://localhost:5173',
  SESSION_COOKIE_NAME: 'eklesia_session',
  SESSION_TTL_DAYS: 7,
  NODE_ENV: 'test',
};

export interface TestContext {
  app: ReturnType<typeof createApp>;
  ownerDb: Database;
  appDb: Database;
  close: () => Promise<void>;
  unique: (prefix: string) => string;
}

let counter = 0;

/** Membangun aplikasi lengkap di atas database uji. */
export function buildTestApp(): TestContext {
  const owner = createDatabase(testOwnerUrl());
  const appDb = createDatabase(testAppUrl());
  const mailer = createMailer(
    {
      APP_NAME: 'Eklesia',
      APP_BASE_URL: 'http://localhost:5173',
      SESSION_COOKIE_NAME: 'eklesia_session',
      SESSION_TTL_DAYS: 7,
      NODE_ENV: 'test',
      HOST: '127.0.0.1',
      PORT: 3000,
      DATABASE_URL: testAppUrl(),
      LOG_LEVEL: 'silent',
    } as never,
    logger,
  );

  const deps: AppDependencies = {
    appName: 'Eklesia',
    logger,
    db: appDb.db,
    systemDb: owner.db,
    env,
    mailer,
    checkDatabase: async () => undefined,
  };

  return {
    app: createApp(deps),
    ownerDb: owner.db,
    appDb: appDb.db,
    close: async () => {
      await Promise.all([owner.close(), appDb.close()]);
    },
    unique: (prefix: string) => {
      counter += 1;
      return `${prefix}-${Date.now()}-${counter}@test.local`;
    },
  };
}

export async function createTestChurch(
  ownerDb: Database,
  input: { name: string; slug: string },
): Promise<string> {
  const [church] = await ownerDb
    .insert(churches)
    .values({ name: input.name, slug: input.slug, status: 'active', plan: 'free' })
    .returning({ id: churches.id });
  if (!church) {
    throw new Error('Gagal membuat gereja uji.');
  }
  return church.id;
}

export async function createTestUser(
  ownerDb: Database,
  input: { churchId: string; name: string; email: string; role: Role; password?: string },
): Promise<TestAccount> {
  const password = input.password ?? 'Password123';
  const [church] = await ownerDb
    .select({ slug: churches.slug })
    .from(churches)
    .where(eq(churches.id, input.churchId))
    .limit(1);

  await ownerDb.insert(users).values({
    churchId: input.churchId,
    name: input.name,
    email: input.email,
    role: input.role,
    passwordHash: await hashPassword(password),
    isActive: true,
  });

  return {
    email: input.email,
    password,
    churchSlug: church?.slug ?? '',
    role: input.role,
    churchId: input.churchId,
  };
}

/** Membersihkan data uji antar test; hanya tabel auth Fase 1. */
export async function clearAuthTables(ownerDb: Database): Promise<void> {
  await ownerDb.execute(sql`truncate table sessions, auth_tokens, users, churches cascade`);
}

export const CSRF_HEADERS = {
  Origin: 'http://localhost',
  'Sec-Fetch-Site': 'same-origin',
};
