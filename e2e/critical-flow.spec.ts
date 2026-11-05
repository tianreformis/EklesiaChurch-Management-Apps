import { expect, test, type Page } from '@playwright/test';
import ExcelJS from 'exceljs';

const ADMIN_EMAIL = 'admin@gki-contoh.test';
const DEMO_PASSWORD = 'Eklesia2026';
const UNIQUE = `E2E${Date.now().toString().slice(-6)}`;

async function login(page: Page): Promise<void> {
  await page.goto('/masuk');
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  // Tunggu sampai benar-benar tiba di dasbor (cookie sesi sudah tersimpan),
  // bukan sekadar teks "Selamat datang" yang juga ada di halaman masuk.
  await page.waitForURL('**/dashboard');
  await expect(page.getByRole('heading', { name: /Selamat datang, / })).toBeVisible();
}

async function buildImportFile(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Anggota');
  sheet.addRow([
    'Nama lengkap*', 'Nama panggilan', 'Jenis kelamin (L/P)', 'Tanggal lahir (YYYY-MM-DD)',
    'No. HP', 'Email', 'Alamat', 'Status (aktif/pindah/meninggal/tidak_aktif)',
    'Baptis (YYYY-MM-DD)', 'Sidi (YYYY-MM-DD)', 'Nikah (YYYY-MM-DD)', 'Catatan',
  ]);
  for (let index = 1; index <= 3; index += 1) {
    sheet.addRow([
      `Anggota ${UNIQUE} Nomor ${index}`, '', index % 2 ? 'L' : 'P', '1992-04-12',
      `089${UNIQUE.replace(/\D/g, '')}${index}`, '', '', 'aktif', '', '', '', 'uji e2e',
    ]);
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

test('alur kritis: masuk → impor jemaat → buat jadwal → catat persembahan → cetak laporan', async ({ page }) => {
  await login(page);

  // 1) Impor jemaat dari Excel.
  await page.goto('/jemaat');
  await page.getByRole('button', { name: 'Impor Excel' }).click();
  const buffer = await buildImportFile();
  await page.locator('#import-file').setInputFiles({
    name: 'jemaat-e2e.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer,
  });
  await expect(page.getByText('3 siap diimpor')).toBeVisible();
  await page.getByRole('button', { name: 'Konfirmasi impor' }).click();
  await expect(page.getByText('Impor selesai')).toBeVisible();
  await expect(page.getByText('3 anggota baru ditambahkan')).toBeVisible();
  await page.getByRole('button', { name: 'Selesai', exact: true }).click();

  // Anggota hasil impor tampil di daftar.
  await page.getByLabel('Cari nama, HP, atau email').fill(UNIQUE);
  await page.getByRole('button', { name: 'Cari', exact: true }).click();
  await expect(page.getByText(`Anggota ${UNIQUE} Nomor 1`)).toBeVisible();

  // 2) Buat jadwal ibadah dan tugaskan pelayan.
  await page.goto('/jadwal');
  await page.getByRole('button', { name: 'Tambah ibadah' }).click();
  await page.getByLabel('Nama ibadah *').fill(`Ibadah ${UNIQUE}`);
  await page.getByLabel('Tanggal *').fill('2026-11-08');
  await page.getByRole('button', { name: 'Tambah ibadah', exact: true }).last().click();
  await expect(page.getByText(`Ibadah ${UNIQUE}`).first()).toBeVisible();

  await page.getByText(`Ibadah ${UNIQUE}`).first().click();
  const panel = page.locator('div', { has: page.getByText('Belum ada pelayan ditugaskan.') }).last();
  void panel;
  const comboboxes = page.getByRole('combobox');
  await comboboxes.nth(0).click();
  await page.getByRole('option').first().click();
  await comboboxes.nth(1).click();
  await page.getByRole('option').first().click();
  await page.getByRole('button', { name: 'Tugaskan' }).click();
  await expect(page.getByText('Belum ada pelayan ditugaskan.')).toBeHidden();

  // 3) Catat persembahan Minggu.
  await page.goto('/keuangan');
  await page.getByRole('tab', { name: 'Persembahan Minggu' }).click();
  const offeringComboboxes = page.getByRole('combobox');
  await offeringComboboxes.nth(0).click();
  await page.getByRole('option', { name: new RegExp(UNIQUE) }).click();
  await offeringComboboxes.nth(1).click();
  await page.getByRole('option').first().click();
  await page.getByLabel('Dihitung oleh').fill('Penghitung E2E');
  await page.getByLabel('Diverifikasi oleh').fill('Pemeriksa E2E');
  await page.getByLabel('Persembahan Minggu (Rp)').first().fill('150000');
  await page.getByRole('button', { name: 'Simpan persembahan' }).click();
  await expect(page.getByText(/Persembahan tercatat: Rp/)).toBeVisible();

  // 4) Cetak (unduh) laporan PDF.
  await page.getByRole('tab', { name: 'Laporan & Periode' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Unduh PDF' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/laporan-.*\.pdf$/);
});
