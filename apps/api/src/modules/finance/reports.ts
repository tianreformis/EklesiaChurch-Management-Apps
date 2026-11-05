import { createElement, type ReactElement } from 'react';
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer';
import ExcelJS from 'exceljs';
import { and, asc, eq, gte, lt, lte, sql } from 'drizzle-orm';
import { formatRupiah } from '@eklesia/shared';
import type { TenantDb } from '../../db/tenant.js';
import { cashAccounts, financeCategories, transactions } from '../../db/schema/index.js';
import { recordAudit } from '../audit/service.js';
import type { FinanceActor } from './service.js';

export interface CategoryTotal {
  categoryId: string;
  name: string;
  total: number;
}

export interface AccountReport {
  accountId: string;
  name: string;
  openingBalance: number;
  incomeByCategory: CategoryTotal[];
  expenseByCategory: CategoryTotal[];
  totalIncome: number;
  totalExpense: number;
  closingBalance: number;
}

function monthBounds(year: number, month: number): { from: string; to: string; nextFrom: string } {
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  return { from, to, nextFrom: `${next.y}-${String(next.m).padStart(2, '0')}-01` };
}

/** Signed sum of active transactions for an account before a date. */
async function signedSumBefore(
  tenant: TenantDb,
  accountId: string,
  beforeDate: string,
): Promise<number> {
  const [row] = await tenant
    .select({
      total: sql<number>`coalesce(sum(case when ${transactions.type} = 'in' then ${transactions.amount} else -${transactions.amount} end), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.accountId, accountId),
        eq(transactions.status, 'aktif'),
        lt(transactions.date, beforeDate),
      ),
    );
  return Number(row?.total ?? 0);
}

async function categoryTotals(
  tenant: TenantDb,
  accountId: string,
  type: 'in' | 'out',
  from: string,
  to: string,
): Promise<CategoryTotal[]> {
  const rows = await tenant
    .select({
      categoryId: financeCategories.id,
      name: financeCategories.name,
      total: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .innerJoin(financeCategories, eq(transactions.categoryId, financeCategories.id))
    .where(
      and(
        eq(transactions.accountId, accountId),
        eq(transactions.type, type),
        eq(transactions.status, 'aktif'),
        gte(transactions.date, from),
        lte(transactions.date, to),
      ),
    )
    .groupBy(financeCategories.id, financeCategories.name)
    .orderBy(asc(financeCategories.name));
  return rows.map((row) => ({ categoryId: row.categoryId, name: row.name, total: Number(row.total) }));
}

/**
 * Laporan bulanan per akun kas, dihitung di server. Rekonsiliasi selalu
 * berlaku: saldoAwal + pemasukan − pengeluaran = saldoAkhir.
 */
export async function monthlyReport(tenant: TenantDb, year: number, month: number) {
  const { from, to } = monthBounds(year, month);
  const accounts = await tenant.select().from(cashAccounts).orderBy(asc(cashAccounts.name));
  const accountReports: AccountReport[] = [];
  for (const account of accounts) {
    const prior = await signedSumBefore(tenant, account.id, from);
    const openingBalance = account.openingBalance + prior;
    const incomeByCategory = await categoryTotals(tenant, account.id, 'in', from, to);
    const expenseByCategory = await categoryTotals(tenant, account.id, 'out', from, to);
    const totalIncome = incomeByCategory.reduce((sum, item) => sum + item.total, 0);
    const totalExpense = expenseByCategory.reduce((sum, item) => sum + item.total, 0);
    accountReports.push({
      accountId: account.id,
      name: account.name,
      openingBalance,
      incomeByCategory,
      expenseByCategory,
      totalIncome,
      totalExpense,
      closingBalance: openingBalance + totalIncome - totalExpense,
    });
  }
  return {
    year,
    month,
    accounts: accountReports,
    totalIncome: accountReports.reduce((sum, item) => sum + item.totalIncome, 0),
    totalExpense: accountReports.reduce((sum, item) => sum + item.totalExpense, 0),
  };
}

/** Laporan tahunan: ringkasan per bulan dan per kategori (semua akun). */
export async function yearlyReport(tenant: TenantDb, year: number) {
  const months: { month: number; totalIncome: number; totalExpense: number }[] = [];
  for (let month = 1; month <= 12; month += 1) {
    const report = await monthlyReport(tenant, year, month);
    months.push({ month, totalIncome: report.totalIncome, totalExpense: report.totalExpense });
  }
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const totalsFor = async (type: 'in' | 'out') => {
    const rows = await tenant
      .select({
        categoryId: financeCategories.id,
        name: financeCategories.name,
        total: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
      })
      .from(transactions)
      .innerJoin(financeCategories, eq(transactions.categoryId, financeCategories.id))
      .where(
        and(
          eq(transactions.type, type),
          eq(transactions.status, 'aktif'),
          gte(transactions.date, from),
          lte(transactions.date, to),
        ),
      )
      .groupBy(financeCategories.id, financeCategories.name)
      .orderBy(asc(financeCategories.name));
    return rows.map((row) => ({ categoryId: row.categoryId, name: row.name, total: Number(row.total) }));
  };
  return {
    year,
    months,
    incomeByCategory: await totalsFor('in'),
    expenseByCategory: await totalsFor('out'),
    totalIncome: months.reduce((sum, item) => sum + item.totalIncome, 0),
    totalExpense: months.reduce((sum, item) => sum + item.totalExpense, 0),
  };
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const pdfStyles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: 'Helvetica' },
  churchName: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  title: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 10 },
  accountTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginTop: 8, marginBottom: 3 },
  row: { flexDirection: 'row', marginLeft: 8 },
  label: { flex: 1 },
  amount: { width: 130, textAlign: 'right' },
  bold: { fontFamily: 'Helvetica-Bold' },
  footer: { marginTop: 14, color: '#666' },
});

/** PDF laporan bulanan dengan kop nama gereja, dibuat di server. */
export async function buildMonthlyReportPdf(
  tenant: TenantDb,
  churchName: string,
  year: number,
  month: number,
): Promise<Buffer> {
  const report = await monthlyReport(tenant, year, month);
  const blocks: ReactElement[] = [];
  report.accounts.forEach((account, accountIndex) => {
    const children: ReactElement[] = [
      createElement(Text, { key: 'name', style: pdfStyles.accountTitle }, account.name),
      createElement(
        View,
        { key: 'open', style: pdfStyles.row },
        createElement(Text, { style: pdfStyles.label }, 'Saldo awal'),
        createElement(Text, { style: pdfStyles.amount }, formatRupiah(account.openingBalance)),
      ),
    ];
    account.incomeByCategory.forEach((item, index) => {
      children.push(
        createElement(
          View,
          { key: `in-${index}`, style: pdfStyles.row },
          createElement(Text, { style: pdfStyles.label }, `Pemasukan — ${item.name}`),
          createElement(Text, { style: pdfStyles.amount }, formatRupiah(item.total)),
        ),
      );
    });
    account.expenseByCategory.forEach((item, index) => {
      children.push(
        createElement(
          View,
          { key: `out-${index}`, style: pdfStyles.row },
          createElement(Text, { style: pdfStyles.label }, `Pengeluaran — ${item.name}`),
          createElement(Text, { style: pdfStyles.amount }, formatRupiah(item.total)),
        ),
      );
    });
    children.push(
      createElement(
        View,
        { key: 'close', style: pdfStyles.row },
        createElement(Text, { style: { ...pdfStyles.label, ...pdfStyles.bold } }, 'Saldo akhir'),
        createElement(
          Text,
          { style: { ...pdfStyles.amount, ...pdfStyles.bold } },
          formatRupiah(account.closingBalance),
        ),
      ),
    );
    blocks.push(createElement(View, { key: `account-${accountIndex}` }, ...children));
  });

  const document = createElement(
    Document,
    null,
    createElement(
      Page,
      { size: 'A4', style: pdfStyles.page },
      createElement(Text, { style: pdfStyles.churchName }, churchName),
      createElement(
        Text,
        { style: pdfStyles.title },
        `Laporan Keuangan — ${MONTH_NAMES[month - 1]} ${year}`,
      ),
      ...blocks,
      createElement(
        Text,
        { style: pdfStyles.footer },
        'Laporan dibuat oleh Eklesia. Transaksi yang dibatalkan (void) tidak dihitung.',
      ),
    ),
  );
  const buffer = await renderToBuffer(document);
  return Buffer.from(buffer);
}

/** Excel laporan untuk periode bulan atau tahun penuh. */
export async function buildReportExcel(
  tenant: TenantDb,
  actor: FinanceActor,
  year: number,
  month: number | undefined,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Eklesia';
  const sheet = workbook.addWorksheet('Laporan');
  sheet.addRow(['Keterangan', 'Pemasukan (Rp)', 'Pengeluaran (Rp)', 'Saldo (Rp)']);
  sheet.getRow(1).font = { bold: true };

  if (month) {
    const report = await monthlyReport(tenant, year, month);
    for (const account of report.accounts) {
      sheet.addRow([`Akun: ${account.name}`, '', '', '']);
      sheet.addRow(['Saldo awal', '', '', account.openingBalance]);
      for (const item of account.incomeByCategory) {
        sheet.addRow([`Pemasukan — ${item.name}`, item.total, '', '']);
      }
      for (const item of account.expenseByCategory) {
        sheet.addRow([`Pengeluaran — ${item.name}`, '', item.total, '']);
      }
      sheet.addRow(['Saldo akhir', '', '', account.closingBalance]);
      sheet.addRow([]);
    }
  } else {
    const report = await yearlyReport(tenant, year);
    for (const item of report.months) {
      sheet.addRow([MONTH_NAMES[item.month - 1]!, item.totalIncome, item.totalExpense, item.totalIncome - item.totalExpense]);
    }
    sheet.addRow([]);
    for (const item of report.incomeByCategory) {
      sheet.addRow([`Pemasukan — ${item.name}`, item.total, '', '']);
    }
    for (const item of report.expenseByCategory) {
      sheet.addRow([`Pengeluaran — ${item.name}`, '', item.total, '']);
    }
  }
  sheet.columns.forEach((column) => {
    column.width = 28;
  });

  await recordAudit(tenant, {
    churchId: tenant.churchId,
    userId: actor.id,
    entity: 'transaction',
    entityId: null,
    action: 'finance.report_exported',
    after: { year, month: month ?? null, format: 'excel' },
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
