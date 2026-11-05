import ExcelJS from 'exceljs';
import { asc } from 'drizzle-orm';
import type { TenantDb } from '../../db/tenant.js';
import {
  cashAccounts,
  families,
  financeCategories,
  groupMembers,
  groups,
  members,
  regions,
  serviceAssignments,
  serviceRoles,
  services,
  transactions,
  users,
} from '../../db/schema/index.js';
import { recordAudit } from '../audit/service.js';

type Row = Record<string, unknown>;

function addSheet(workbook: ExcelJS.Workbook, name: string, rows: Row[]): void {
  const sheet = workbook.addWorksheet(name);
  if (rows.length === 0) {
    sheet.addRow(['(tidak ada data)']);
    return;
  }
  sheet.addRow(Object.keys(rows[0]!));
  for (const row of rows) {
    sheet.addRow(Object.values(row).map((value) => {
      if (value instanceof Date) return value.toISOString();
      if (value === null || value === undefined) return '';
      return value as string | number;
    }));
  }
  sheet.columns.forEach((column) => {
    column.width = 22;
  });
  sheet.getRow(1).font = { bold: true };
}

/**
 * Ekspor SELURUH data gereja ke satu berkas Excel (fitur backup admin).
 * Hanya data gereja pemanggil; tercatat di audit log karena memuat data
 * pribadi. Password hash tidak pernah ikut.
 */
export async function exportChurchData(
  tenant: TenantDb,
  actor: { id: string },
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Eklesia';

  const memberRows = await tenant.select().from(members).orderBy(asc(members.fullName));
  addSheet(workbook, 'Anggota', memberRows as Row[]);
  addSheet(workbook, 'Keluarga', (await tenant.select().from(families)) as Row[]);
  addSheet(workbook, 'Wilayah', (await tenant.select().from(regions)) as Row[]);
  addSheet(workbook, 'KomisiTim', (await tenant.select().from(groups)) as Row[]);
  addSheet(workbook, 'AnggotaKomisi', (await tenant.select().from(groupMembers)) as Row[]);
  addSheet(workbook, 'PeranPelayanan', (await tenant.select().from(serviceRoles)) as Row[]);
  addSheet(workbook, 'Ibadah', (await tenant.select().from(services)) as Row[]);
  addSheet(workbook, 'Penugasan', (await tenant.select().from(serviceAssignments)) as Row[]);
  addSheet(workbook, 'AkunKas', (await tenant.select().from(cashAccounts)) as Row[]);
  addSheet(workbook, 'KategoriKeuangan', (await tenant.select().from(financeCategories)) as Row[]);
  addSheet(workbook, 'Transaksi', (await tenant.select().from(transactions)) as Row[]);

  const userRows = await tenant
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      memberId: users.memberId,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(asc(users.name));
  addSheet(workbook, 'Pengguna', userRows as Row[]);

  await recordAudit(tenant, {
    churchId: tenant.churchId,
    userId: actor.id,
    entity: 'church',
    entityId: tenant.churchId,
    action: 'church.data_exported',
    after: { members: memberRows.length },
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
