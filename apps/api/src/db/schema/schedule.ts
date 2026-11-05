import {
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { churches } from './churches.js';
import { groups, members } from './members.js';

export const assignmentStatusEnum = pgEnum('assignment_status', [
  'menunggu',
  'dikonfirmasi',
  'ditolak',
]);

export const swapStatusEnum = pgEnum('swap_status', [
  'menunggu_pengganti',
  'menunggu_koordinator',
  'disetujui',
  'ditolak',
  'dibatalkan',
]);

export const serviceStatusEnum = pgEnum('service_status', [
  'terjadwal',
  'selesai',
  'dibatalkan',
]);

/** Peran pelayanan yang dapat diatur tiap gereja, opsional terikat komisi/tim. */
export const serviceRoles = pgTable(
  'service_roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    churchId: uuid('church_id')
      .notNull()
      .references(() => churches.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    groupId: uuid('group_id').references(() => groups.id, { onDelete: 'set null' }),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('service_roles_church_id_idx').on(table.churchId)],
);

/** Ibadah/kegiatan terjadwal. Baris berulang mingguan berbagi `recurrenceId`. */
export const services = pgTable(
  'services',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    churchId: uuid('church_id')
      .notNull()
      .references(() => churches.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    date: date('date').notNull(),
    startTime: text('start_time').notNull(),
    endTime: text('end_time'),
    location: text('location'),
    theme: text('theme'),
    preacher: text('preacher'),
    recurrenceId: uuid('recurrence_id'),
    status: serviceStatusEnum('status').notNull().default('terjadwal'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('services_church_id_idx').on(table.churchId),
    index('services_church_date_idx').on(table.churchId, table.date),
  ],
);

export const serviceAssignments = pgTable(
  'service_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    churchId: uuid('church_id')
      .notNull()
      .references(() => churches.id, { onDelete: 'cascade' }),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
    serviceRoleId: uuid('service_role_id')
      .notNull()
      .references(() => serviceRoles.id, { onDelete: 'cascade' }),
    memberId: uuid('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    status: assignmentStatusEnum('status').notNull().default('menunggu'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('service_assignments_church_id_idx').on(table.churchId),
    index('service_assignments_service_idx').on(table.serviceId),
    index('service_assignments_member_idx').on(table.memberId),
  ],
);

/** Permintaan tukar jadwal: menunggu pengganti → menunggu koordinator → final. */
export const swapRequests = pgTable(
  'swap_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    churchId: uuid('church_id')
      .notNull()
      .references(() => churches.id, { onDelete: 'cascade' }),
    assignmentId: uuid('assignment_id')
      .notNull()
      .references(() => serviceAssignments.id, { onDelete: 'cascade' }),
    requestedBy: uuid('requested_by')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    proposedMemberId: uuid('proposed_member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    status: swapStatusEnum('status').notNull().default('menunggu_pengganti'),
    reason: text('reason'),
    resolvedBy: uuid('resolved_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('swap_requests_church_id_idx').on(table.churchId),
    index('swap_requests_assignment_idx').on(table.assignmentId),
  ],
);

/** Template pesan pengingat per kanal (WhatsApp/email), dapat diubah pengurus. */
export const reminderTemplates = pgTable(
  'reminder_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    churchId: uuid('church_id')
      .notNull()
      .references(() => churches.id, { onDelete: 'cascade' }),
    channel: text('channel').notNull(),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('reminder_templates_church_id_idx').on(table.churchId)],
);

export type ServiceRole = typeof serviceRoles.$inferSelect;
export type Service = typeof services.$inferSelect;
export type ServiceAssignment = typeof serviceAssignments.$inferSelect;
export type SwapRequest = typeof swapRequests.$inferSelect;
export type ReminderTemplate = typeof reminderTemplates.$inferSelect;
