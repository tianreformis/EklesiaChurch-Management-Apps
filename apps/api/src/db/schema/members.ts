import { date, index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { churches } from './churches.js';

export const memberStatusEnum = pgEnum('member_status', [
  'aktif',
  'pindah',
  'meninggal',
  'tidak_aktif',
]);

export const genderEnum = pgEnum('gender', ['laki_laki', 'perempuan']);

export const groupTypeEnum = pgEnum('group_type', ['komisi', 'tim_pelayanan']);

export const members = pgTable(
  'members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    churchId: uuid('church_id')
      .notNull()
      .references(() => churches.id, { onDelete: 'cascade' }),
    familyId: uuid('family_id'),
    regionId: uuid('region_id'),
    fullName: text('full_name').notNull(),
    nickname: text('nickname'),
    gender: genderEnum('gender'),
    birthDate: date('birth_date'),
    phone: text('phone'),
    email: text('email'),
    address: text('address'),
    status: memberStatusEnum('status').notNull().default('aktif'),
    baptismDate: date('baptism_date'),
    sidiDate: date('sidi_date'),
    marriageDate: date('marriage_date'),
    photoUrl: text('photo_url'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('members_church_id_idx').on(table.churchId),
    index('members_church_name_idx').on(table.churchId, table.fullName),
    index('members_church_phone_idx').on(table.churchId, table.phone),
  ],
);

export const families = pgTable(
  'families',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    churchId: uuid('church_id')
      .notNull()
      .references(() => churches.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    headMemberId: uuid('head_member_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('families_church_id_idx').on(table.churchId)],
);

export const regions = pgTable(
  'regions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    churchId: uuid('church_id')
      .notNull()
      .references(() => churches.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('regions_church_id_idx').on(table.churchId)],
);

export const groups = pgTable(
  'groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    churchId: uuid('church_id')
      .notNull()
      .references(() => churches.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: groupTypeEnum('type').notNull().default('komisi'),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('groups_church_id_idx').on(table.churchId)],
);

export const groupMembers = pgTable(
  'group_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    churchId: uuid('church_id')
      .notNull()
      .references(() => churches.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    memberId: uuid('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    roleInGroup: text('role_in_group'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('group_members_church_id_idx').on(table.churchId),
    index('group_members_group_idx').on(table.groupId),
    index('group_members_member_idx').on(table.memberId),
  ],
);

export type Member = typeof members.$inferSelect;
export type NewMember = typeof members.$inferInsert;
export type Family = typeof families.$inferSelect;
export type Region = typeof regions.$inferSelect;
export type Group = typeof groups.$inferSelect;
export type GroupMember = typeof groupMembers.$inferSelect;
