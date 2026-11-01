/**
 * Matriks izin tunggal untuk server dan UI.
 *
 * Server WAJIB memeriksa izin lewat `hasPermission`; menyembunyikan tombol di UI
 * bukan keamanan. `super_admin` tidak memakai matriks ini (perannya platform).
 */

export const ROLES = [
  'admin_gereja',
  'bendahara',
  'majelis',
  'sekretaris',
  'koordinator_komisi',
  'pelayan',
  'jemaat',
] as const;

export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  'members.read',
  'members.write',
  'members.import',
  'members.export',
  'schedule.read',
  'schedule.write',
  'schedule.assign',
  'schedule.swap.request',
  'schedule.swap.approve',
  'schedule.remind',
  'finance.read',
  'finance.write',
  'finance.void',
  'finance.report',
  'finance.audit',
  'users.manage',
  'church.manage',
  'church.backup',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin_gereja: 'Admin gereja',
  bendahara: 'Bendahara',
  majelis: 'Majelis',
  sekretaris: 'Sekretaris',
  koordinator_komisi: 'Koordinator komisi',
  pelayan: 'Pelayan',
  jemaat: 'Jemaat',
};

const ALL: readonly Permission[] = PERMISSIONS;

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  admin_gereja: ALL,
  bendahara: ['finance.read', 'finance.write', 'finance.void', 'finance.report'],
  majelis: ['members.read', 'schedule.read', 'finance.read', 'finance.audit'],
  sekretaris: [
    'members.read',
    'members.write',
    'members.import',
    'members.export',
    'schedule.read',
    'schedule.write',
    'schedule.assign',
    'schedule.remind',
  ],
  koordinator_komisi: [
    'members.read',
    'schedule.read',
    'schedule.assign',
    'schedule.swap.approve',
    'schedule.remind',
  ],
  pelayan: ['schedule.read', 'schedule.swap.request'],
  jemaat: [],
};

export function permissionsFor(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function canAny(role: Role, permissions: readonly Permission[]): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

/** Apakah aktor boleh mengelola pengguna dengan peran target. */
export function canManageRole(actorRole: Role, targetRole: Role): boolean {
  if (actorRole !== 'admin_gereja') {
    return false;
  }
  // Admin gereja tidak bisa menurunkan/mengubah admin lain lewat aturan ini;
  // perubahan peran antar-admin ditangani service (harus tersisa satu admin).
  return targetRole !== 'admin_gereja';
}
