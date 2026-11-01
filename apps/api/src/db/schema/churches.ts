import { boolean, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/** Paket langganan gereja. Diterapkan penuh pada tahap 2; MVP hanya mencatat. */
export const churchPlanEnum = pgEnum('church_plan', ['free', 'basic', 'pro']);

/** Status gereja (tenant). Gereja `suspended` tidak boleh dipakai penggunanya. */
export const churchStatusEnum = pgEnum('church_status', ['active', 'suspended']);

/**
 * Tabel akar multi-tenant. Semua tabel milik gereja lain wajib mereferensikan
 * `churches.id` lewat kolom NOT NULL `church_id` yang terindeks.
 */
export const churches = pgTable('churches', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  address: text('address'),
  phone: text('phone'),
  logoUrl: text('logo_url'),
  timezone: text('timezone').notNull().default('Asia/Jakarta'),
  plan: churchPlanEnum('plan').notNull().default('free'),
  status: churchStatusEnum('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Pemilik platform. Tidak terikat gereja dan tidak boleh melihat data jemaat
 * maupun keuangan gereja.
 */
export const superAdmins = pgTable('super_admins', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Church = typeof churches.$inferSelect;
export type NewChurch = typeof churches.$inferInsert;
export type SuperAdmin = typeof superAdmins.$inferSelect;
export type NewSuperAdmin = typeof superAdmins.$inferInsert;
