import ExcelJS from 'exceljs';
import type { CreateMemberInput, ImportAction, ImportPreviewRow } from '@eklesia/shared';
import { createMemberSchema } from '@eklesia/shared';
import type { TenantDb } from '../../db/tenant.js';
import { badRequest, forbidden } from '../../lib/errors.js';
import { recordAudit } from '../audit/service.js';
import { createMember, findDuplicate, normalizePhone, type Actor } from './service.js';

/** Batas impor sesuai aturan keamanan: maks 5 MB dan 5.000 baris data. */
export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;
export const IMPORT_MAX_ROWS = 5000;
export const IMPORT_COLUMNS = [
  'Nama lengkap*',
  'Nama panggilan',
  'Jenis kelamin (L/P)',
  'Tanggal lahir (YYYY-MM-DD)',
  'No. HP',
  'Email',
  'Alamat',
  'Status (aktif/pindah/meninggal/tidak_aktif)',
  'Baptis (YYYY-MM-DD)',
  'Sidi (YYYY-MM-DD)',
  'Nikah (YYYY-MM-DD)',
  'Catatan',
] as const;

interface RawRow {
  rowNumber: number;
  values: Record<string, string>;
}

function cellText(value: ExcelJS.CellValue | undefined): string {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string') {
      return value.text.trim();
    }
    if ('result' in value && value.result !== undefined && value.result !== null) {
      return String(value.result).trim();
    }
    return '';
  }
  return String(value).trim();
}

function parseGender(value: string): CreateMemberInput['gender'] {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'l' || normalized === 'laki-laki' || normalized === 'laki_laki') {
    return 'laki_laki';
  }
  if (normalized === 'p' || normalized === 'perempuan') {
    return 'perempuan';
  }
  return undefined;
}

/**
 * Membuat berkas template impor kosong dengan contoh dua baris dan petunjuk.
 * Kepala kolom memakai Bahasa Indonesia agar mudah dipakai pengurus.
 */
export async function buildImportTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Eklesia';
  const sheet = workbook.addWorksheet('Anggota');
  sheet.addRow([...IMPORT_COLUMNS]);
  sheet.addRow([
    'Maria Simanjuntak',
    'Maria',
    'P',
    '1985-03-12',
    '081234567890',
    'maria@contoh.id',
    'Jl. Melati No. 1',
    'aktif',
    '1986-04-20',
    '1999-05-10',
    '2010-06-14',
    'Contoh baris — hapus sebelum impor.',
  ]);
  sheet.columns.forEach((column) => {
    column.width = 24;
  });
  sheet.getRow(1).font = { bold: true };
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Membaca berkas unggahan dan mengembalikan pratinjau per baris tanpa menulis
 * apa pun ke database. Setiap baris divalidasi dengan skema Zod bersama dan
 * diperiksa duplikatnya; baris rusak tidak menggagalkan baris lain.
 */
export async function previewImport(
  tenant: TenantDb,
  buffer: Buffer,
): Promise<{ rows: ImportPreviewRow[]; totalRows: number; errorRows: number }> {
  if (buffer.length > IMPORT_MAX_BYTES) {
    throw badRequest('Berkas terlalu besar. Maksimal 5 MB.');
  }
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw badRequest('Berkas tidak dapat dibaca. Gunakan template Excel yang disediakan.');
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw badRequest('Berkas tidak berisi lembar kerja.');
  }

  const header = sheet.getRow(1).values as unknown[];
  if (!Array.isArray(header) || header.length < 2) {
    throw badRequest('Baris pertama harus berisi kepala kolom template.');
  }

  const rawRows: RawRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }
    const cells = row.values as unknown[];
    const values: Record<string, string> = {};
    IMPORT_COLUMNS.forEach((column, index) => {
      // ExcelJS memakai indeks 1-based.
      values[column] = cellText(cells[index + 1] as ExcelJS.CellValue | undefined);
    });
    const isEmpty = Object.values(values).every((value) => value === '');
    if (isEmpty) {
      return;
    }
    rawRows.push({ rowNumber, values });
  });

  if (rawRows.length === 0) {
    throw badRequest('Tidak ada baris data. Isi minimal satu baris anggota.');
  }
  if (rawRows.length > IMPORT_MAX_ROWS) {
    throw badRequest(`Maksimal ${IMPORT_MAX_ROWS.toLocaleString('id-ID')} baris per impor.`);
  }

  const rows: ImportPreviewRow[] = [];
  for (const raw of rawRows) {
    const candidate: Record<string, unknown> = {
      fullName: raw.values['Nama lengkap*'],
      nickname: raw.values['Nama panggilan'] || undefined,
      gender: parseGender(raw.values['Jenis kelamin (L/P)'] ?? ''),
      birthDate: raw.values['Tanggal lahir (YYYY-MM-DD)'] || undefined,
      phone: raw.values['No. HP'] || undefined,
      email: raw.values['Email'] || undefined,
      address: raw.values['Alamat'] || undefined,
      status: raw.values['Status (aktif/pindah/meninggal/tidak_aktif)'] || 'aktif',
      baptismDate: raw.values['Baptis (YYYY-MM-DD)'] || undefined,
      sidiDate: raw.values['Sidi (YYYY-MM-DD)'] || undefined,
      marriageDate: raw.values['Nikah (YYYY-MM-DD)'] || undefined,
      notes: raw.values['Catatan'] || undefined,
    };
    const parsed = createMemberSchema.safeParse(candidate);
    const errors: string[] = [];
    let data: CreateMemberInput = {} as CreateMemberInput;
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push(`${issue.path.join('.') || 'baris'}: ${issue.message}`);
      }
    } else {
      data = parsed.data;
      const duplicate = await findDuplicate(tenant, {
        fullName: data.fullName,
        birthDate: data.birthDate,
        phone: data.phone,
      });
      if (duplicate) {
        errors.push(`Kemungkinan duplikat dengan "${duplicate.fullName}".`);
        rows.push({
          rowNumber: raw.rowNumber,
          data,
          errors,
          duplicateOf: duplicate.id,
          action: 'skip',
        });
        continue;
      }
      rows.push({ rowNumber: raw.rowNumber, data, errors, duplicateOf: null, action: 'skip' });
      continue;
    }
    rows.push({
      rowNumber: raw.rowNumber,
      data: data as CreateMemberInput,
      errors,
      duplicateOf: null,
      action: 'skip',
    });
  }

  return {
    rows,
    totalRows: rows.length,
    errorRows: rows.filter((row) => row.errors.length > 0).length,
  };
}

export interface ConfirmRowInput {
  rowNumber: number;
  action: ImportAction;
}

/**
 * Menjalankan impor yang sudah dipratinjau. Hanya baris valid yang ditulis;
 * `skip` melewati duplikat, `update` memperbarui data duplikatnya. Aturan
 * DESCRIPTION.md: impor tidak boleh menimpa tanpa pratinjau — pemanggil wajib
 * mengirim hasil pilihan dari pratinjau.
 */
export async function confirmImport(
  tenant: TenantDb,
  actor: Actor,
  preview: ImportPreviewRow[],
  choices: ConfirmRowInput[],
): Promise<{ created: number; updated: number; skipped: number; errors: string[] }> {
  const choiceMap = new Map(choices.map((choice) => [choice.rowNumber, choice.action]));
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of preview) {
    if (row.errors.length > 0 && !row.duplicateOf) {
      skipped += 1;
      errors.push(`Baris ${row.rowNumber}: ${row.errors.join('; ')}`);
      continue;
    }
    const action = choiceMap.get(row.rowNumber) ?? 'skip';
    if (row.duplicateOf) {
      if (action === 'update') {
        // Pembaruan duplikat memakai service update agar audit tercatat.
        const { updateMember } = await import('./service.js');
        try {
          await updateMember(tenant, actor, row.duplicateOf, {
            fullName: row.data.fullName,
            nickname: row.data.nickname,
            phone: row.data.phone,
            address: row.data.address,
          });
          updated += 1;
        } catch (error) {
          skipped += 1;
          errors.push(
            `Baris ${row.rowNumber}: gagal memperbarui (${error instanceof Error ? error.message : 'kesalahan'})`,
          );
        }
      } else {
        skipped += 1;
      }
      continue;
    }
    try {
      // Validasi ulang agar data tidak bisa disusupkan lewat pilihan palsu.
      const parsed = createMemberSchema.safeParse(row.data);
      if (!parsed.success) {
        skipped += 1;
        errors.push(`Baris ${row.rowNumber}: data tidak valid.`);
        continue;
      }
      const duplicate = await findDuplicate(tenant, {
        fullName: parsed.data.fullName,
        birthDate: parsed.data.birthDate,
        phone: parsed.data.phone,
      });
      if (duplicate) {
        skipped += 1;
        errors.push(`Baris ${row.rowNumber}: duplikat dengan "${duplicate.fullName}".`);
        continue;
      }
      await createMember(tenant, actor, {
        ...parsed.data,
        phone: parsed.data.phone ? (normalizePhone(parsed.data.phone) ?? parsed.data.phone) : undefined,
      });
      created += 1;
    } catch (error) {
      skipped += 1;
      errors.push(
        `Baris ${row.rowNumber}: ${error instanceof Error ? error.message : 'gagal disimpan'}`,
      );
    }
  }

  await recordAudit(tenant, {
    churchId: tenant.churchId,
    userId: actor.id,
    entity: 'member',
    entityId: null,
    action: 'member.imported',
    after: { created, updated, skipped },
  });

  return { created, updated, skipped, errors };
}

export interface ExportFilters {
  status?: CreateMemberInput['status'];
  regionId?: string;
}

/** Mengekspor anggota ke berkas Excel dengan kolom yang sama seperti template. */
export async function exportMembers(
  tenant: TenantDb,
  actor: Actor,
  filters: ExportFilters,
): Promise<Buffer> {
  const { listMembers } = await import('./service.js');
  const result = await listMembers(tenant, {
    page: 1,
    perPage: 100,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.regionId ? { regionId: filters.regionId } : {}),
  });

  // Ambil semua halaman bila data lebih dari 100 baris.
  const allItems = [...result.items];
  const totalPages = result.meta.totalPages;
  for (let page = 2; page <= totalPages; page += 1) {
    const next = await listMembers(tenant, {
      page,
      perPage: 100,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.regionId ? { regionId: filters.regionId } : {}),
    });
    allItems.push(...next.items);
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Eklesia';
  const sheet = workbook.addWorksheet('Anggota');
  sheet.addRow([...IMPORT_COLUMNS]);
  for (const item of allItems) {
    sheet.addRow([
      item.fullName,
      item.nickname ?? '',
      item.gender === 'laki_laki' ? 'L' : item.gender === 'perempuan' ? 'P' : '',
      item.birthDate ?? '',
      item.phone ?? '',
      item.email ?? '',
      item.address ?? '',
      item.status,
      item.baptismDate ?? '',
      item.sidiDate ?? '',
      item.marriageDate ?? '',
      item.notes ?? '',
    ]);
  }
  sheet.columns.forEach((column) => {
    column.width = 24;
  });
  sheet.getRow(1).font = { bold: true };

  await recordAudit(tenant, {
    churchId: tenant.churchId,
    userId: actor.id,
    entity: 'member',
    entityId: null,
    action: 'member.exported',
    after: { count: allItems.length },
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/** Ukuran berkas di atas batas → 413 agar klien tahu persis masalahnya. */
export function assertImportSize(size: number): void {
  if (size > IMPORT_MAX_BYTES) {
    throw forbidden('Berkas terlalu besar. Maksimal 5 MB.');
  }
}
