import { createApp, type AppDependencies } from '../src/app.js';
import { createDatabase } from '../src/db/client.js';
import { createLogger } from '../src/lib/logger.js';
import { createMailer } from '../src/lib/mailer.js';
import { hashPassword } from '../src/lib/passwords.js';
import { churches, users } from '../src/db/schema/index.js';
import { testAppUrl, testOwnerUrl, migrateTestDatabase } from '../src/test/setup.js';

await migrateTestDatabase();
const owner = createDatabase(testOwnerUrl());
const appDb = createDatabase(testAppUrl());
const logger = createLogger({ level: 'debug', appName: 'Eklesia' });
const mailer = createMailer({} as never, logger);
const deps: AppDependencies = {
  appName: 'Eklesia',
  logger,
  db: appDb.db,
  systemDb: owner.db,
  env: {
    APP_NAME: 'Eklesia',
    APP_BASE_URL: 'http://localhost:5173',
    SESSION_COOKIE_NAME: 'eklesia_session',
    SESSION_TTL_DAYS: 7,
    NODE_ENV: 'test',
  },
  mailer,
  checkDatabase: async () => undefined,
};
const app = createApp(deps);

await owner.db.execute(
  (await import('drizzle-orm')).sql`truncate table sessions, auth_tokens, users, churches cascade`,
);
const [church] = await owner.db
  .insert(churches)
  .values({ name: 'G', slug: 'g-debug-invite' })
  .returning({ id: churches.id });
await owner.db.insert(users).values({
  churchId: church!.id,
  name: 'Admin',
  email: 'dbg-admin@test.local',
  role: 'admin_gereja',
  passwordHash: await hashPassword('Password123'),
  isActive: true,
});

const login = await app.request('/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Origin: 'http://localhost',
    'Sec-Fetch-Site': 'same-origin',
  },
  body: JSON.stringify({ email: 'dbg-admin@test.local', password: 'Password123' }),
});
console.log('login', login.status);
const cookie = login.headers.getSetCookie()[0]!.split(';')[0]!;

const invite = await app.request('/api/users/invite', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: 'http://localhost', 'Sec-Fetch-Site': 'same-origin' },
  body: JSON.stringify({ name: 'Baru', email: 'dbg-baru@test.local', role: 'pelayan' }),
});
console.log('invite', invite.status);
console.log(await invite.text());
await owner.close();
await appDb.close();
