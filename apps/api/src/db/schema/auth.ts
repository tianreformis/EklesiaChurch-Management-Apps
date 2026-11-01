import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { churches } from './churches.js';

export const userRoleEnum = pgEnum('user_role', [
  'admin_gereja',
  'bendahara',
  'majelis',
  'sekretaris',
  'koordinator_komisi',
  'pelayan',
  'jemaat',
]);

export const authTokenTypeEnum = pgEnum('auth_token_type', ['invitation', 'password_reset']);

/**
 * Pengguna aplikasi milik satu gereja. Email dibuat unik secara global (bukan
 * hanya per gereja) agar alur masuk cukup memakai email tanpa memilih tenant;
 * lihat catatan keputusan di PROGRESS.md.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    churchId: uuid('church_id')
      .notNull()
      .references(() => churches.id, { onDelete: 'cascade' }),
    memberId: uuid('member_id'),
    name: text('name').notNull(),
    email: text('email').notNull(),
    /** Null sampai pengguna menerima undangan dan menetapkan password. */
    passwordHash: text('password_hash'),
    role: userRoleEnum('role').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('users_church_id_idx').on(table.churchId),
    uniqueIndex('users_email_lower_unique').on(sql`lower(${table.email})`),
  ],
);

/**
 * Sesi disimpan di database; yang disimpan hanya hash SHA-256 dari token acak.
 * Sesi bisa milik pengguna gereja atau super_admin (salah satu saja).
 */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    churchId: uuid('church_id').references(() => churches.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    superAdminId: uuid('super_admin_id'),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('sessions_user_id_idx').on(table.userId),
    index('sessions_expires_at_idx').on(table.expiresAt),
  ],
);

/** Token sekali pakai untuk undangan dan atur ulang password. */
export const authTokens = pgTable(
  'auth_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    churchId: uuid('church_id')
      .notNull()
      .references(() => churches.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: authTokenTypeEnum('type').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('auth_tokens_user_id_idx').on(table.userId)],
);

/**
 * Jejak audit aksi sensitif. Tidak pernah dihapus; `before`/`after` memuat
 * potret data terkait. Baris platform (super_admin) boleh tanpa church_id.
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    churchId: uuid('church_id').references(() => churches.id, { onDelete: 'cascade' }),
    userId: uuid('user_id'),
    entity: text('entity').notNull(),
    entityId: text('entity_id'),
    action: text('action').notNull(),
    before: jsonb('before'),
    after: jsonb('after'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('audit_logs_church_created_idx').on(table.churchId, table.createdAt)],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type AuthToken = typeof authTokens.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
