import { describe, expect, it } from 'vitest';
import { ROLES, canManageRole, hasPermission, permissionsFor } from './permissions.js';

describe('matriks izin', () => {
  it('admin gereja memiliki semua izin', () => {
    expect(permissionsFor('admin_gereja')).toContain('church.manage');
    expect(permissionsFor('admin_gereja')).toContain('finance.write');
  });

  it('bendahara boleh menulis transaksi tetapi tidak mengelola pengguna', () => {
    expect(hasPermission('bendahara', 'finance.write')).toBe(true);
    expect(hasPermission('bendahara', 'users.manage')).toBe(false);
  });

  it('majelis hanya membaca keuangan dan tidak boleh menulis', () => {
    expect(hasPermission('majelis', 'finance.read')).toBe(true);
    expect(hasPermission('majelis', 'finance.audit')).toBe(true);
    expect(hasPermission('majelis', 'finance.write')).toBe(false);
    expect(hasPermission('majelis', 'finance.void')).toBe(false);
  });

  it('jemaat tidak memiliki izin modul apa pun', () => {
    expect(permissionsFor('jemaat')).toEqual([]);
  });

  it('setiap peran dikenal dan labelnya tersedia', () => {
    expect(ROLES).toHaveLength(7);
  });

  it('hanya admin gereja yang dapat mengelola peran lain', () => {
    expect(canManageRole('admin_gereja', 'bendahara')).toBe(true);
    expect(canManageRole('admin_gereja', 'admin_gereja')).toBe(false);
    expect(canManageRole('bendahara', 'pelayan')).toBe(false);
  });
});
