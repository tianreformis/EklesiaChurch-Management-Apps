import { useState } from 'react';
import { FileDown, FileSpreadsheet, Lock, LockOpen, Pencil, Plus } from 'lucide-react';
import {
  TRANSACTION_TYPE_LABELS,
  formatRupiah,
  parseRupiahInput,
  type TransactionType,
} from '@eklesia/shared';
import { ErrorAlert } from '@/components/feedback/error-alert';
import { LoadingState } from '@/components/feedback/loading-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useServices } from '@/features/schedule/api';
import { errorMessage } from '@/lib/http';
import {
  downloadApiFile,
  useAccounts,
  useCategories,
  useCreateAccount,
  useCreateCategory,
  useCreateOffering,
  useLockPeriod,
  useMonthlyReport,
  usePeriodLocks,
  useUnlockPeriod,
  useUpdateAccount,
  useUpdateCategory,
  useYearlyReport,
} from './api';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export function OfferingSection({ canWrite, monthKey }: { canWrite: boolean; monthKey: string }) {
  const services = useServices(monthKey);
  const accounts = useAccounts();
  const categories = useCategories();
  const create = useCreateOffering();
  const [serviceId, setServiceId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [countedBy, setCountedBy] = useState('');
  const [verifiedBy, setVerifiedBy] = useState('');
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [doneTotal, setDoneTotal] = useState<number | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const incomeCategories = (categories.data ?? []).filter((c) => c.type === 'in' && c.isActive);

  const submit = async () => {
    setLocalError(null);
    setDoneTotal(null);
    const entries = incomeCategories
      .map((category) => ({ categoryId: category.id, amount: parseRupiahInput(amounts[category.id] ?? '') ?? 0 }))
      .filter((entry) => entry.amount > 0);
    if (!serviceId || !accountId) {
      setLocalError('Pilih ibadah dan akun kas terlebih dahulu.');
      return;
    }
    if (!countedBy.trim() || !verifiedBy.trim()) {
      setLocalError('Nama penghitung dan pemeriksa wajib diisi.');
      return;
    }
    if (entries.length === 0) {
      setLocalError('Isi minimal satu pos persembahan.');
      return;
    }
    try {
      const service = (services.data ?? []).find((item) => item.id === serviceId);
      const result = await create.mutateAsync({
        serviceId,
        accountId,
        date: service?.date ?? `${monthKey}-01`,
        countedBy,
        verifiedBy,
        entries,
      });
      setDoneTotal(result.total);
      setAmounts({});
    } catch (error) {
      setLocalError(errorMessage(error));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Persembahan Minggu</CardTitle>
        <CardDescription>
          Catat hasil hitungan persembahan per pos. Wajib diisi nama penghitung dan pemeriksa
          (dua orang) agar dapat diverifikasi.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {localError ? <ErrorAlert message={localError} /> : null}
        {create.isError ? <ErrorAlert message={errorMessage(create.error)} /> : null}
        {doneTotal !== null ? (
          <p className="rounded-md bg-muted p-3 text-base font-semibold">
            Persembahan tercatat: {formatRupiah(doneTotal)}. Terima kasih, Tuhan memberkati.
          </p>
        ) : null}
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label className="text-base font-semibold">Ibadah</Label>
            <Select value={serviceId} onValueChange={setServiceId} disabled={!canWrite}>
              <SelectTrigger className="min-h-11 w-full text-base"><SelectValue placeholder="Pilih ibadah bulan ini" /></SelectTrigger>
              <SelectContent>
                {(services.data ?? []).map((service) => (
                  <SelectItem key={service.id} value={service.id} className="text-base">
                    {service.date} — {service.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-base font-semibold">Masuk ke akun kas</Label>
            <Select value={accountId} onValueChange={setAccountId} disabled={!canWrite}>
              <SelectTrigger className="min-h-11 w-full text-base"><SelectValue placeholder="Pilih akun" /></SelectTrigger>
              <SelectContent>
                {(accounts.data ?? []).filter((a) => a.isActive).map((account) => (
                  <SelectItem key={account.id} value={account.id} className="text-base">{account.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-base font-semibold">Dihitung oleh</Label>
            <Input className="min-h-11 text-base" value={countedBy} onChange={(e) => setCountedBy(e.target.value)} disabled={!canWrite} />
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-base font-semibold">Diverifikasi oleh</Label>
            <Input className="min-h-11 text-base" value={verifiedBy} onChange={(e) => setVerifiedBy(e.target.value)} disabled={!canWrite} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {incomeCategories.map((category) => (
            <div key={category.id} className="flex flex-col gap-2">
              <Label className="text-base font-semibold">{category.name} (Rp)</Label>
              <Input
                className="min-h-11 text-base"
                inputMode="numeric"
                placeholder="0"
                disabled={!canWrite}
                value={amounts[category.id] ?? ''}
                onChange={(e) => setAmounts((current) => ({ ...current, [category.id]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        {canWrite ? (
          <div>
            <Button size="lg" disabled={create.isPending} onClick={() => void submit()}>
              {create.isPending ? 'Menyimpan…' : 'Simpan persembahan'}
            </Button>
          </div>
        ) : (
          <p className="text-base text-muted-foreground">Peran Anda hanya dapat melihat data keuangan.</p>
        )}
      </CardContent>
    </Card>
  );
}

export function AccountsCategoriesSection({ canWrite }: { canWrite: boolean }) {
  const accounts = useAccounts();
  const categories = useCategories();
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const [accountName, setAccountName] = useState('');
  const [accountOpening, setAccountOpening] = useState('0');
  const [categoryName, setCategoryName] = useState('');
  const [categoryType, setCategoryType] = useState<TransactionType>('in');
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const failure = createAccount.error ?? updateAccount.error ?? createCategory.error ?? updateCategory.error;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Akun kas</CardTitle>
          <CardDescription>Saldo berjalan dihitung otomatis dari transaksi aktif.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {failure ? <ErrorAlert message={errorMessage(failure)} /> : null}
          {canWrite ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label className="text-base font-semibold">{editingAccountId ? 'Ubah akun kas' : 'Nama akun kas baru'}</Label>
                <Input className="min-h-11 text-base" value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="cth. Kas Diakonia" />
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-base font-semibold">Saldo awal (Rp)</Label>
                <Input className="min-h-11 text-base" inputMode="numeric" value={accountOpening} onChange={(e) => setAccountOpening(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button
                  size="lg"
                  disabled={createAccount.isPending || updateAccount.isPending}
                  onClick={async () => {
                    const opening = parseRupiahInput(accountOpening) ?? 0;
                    if (editingAccountId) {
                      await updateAccount.mutateAsync({ id: editingAccountId, input: { name: accountName, openingBalance: opening } });
                    } else {
                      await createAccount.mutateAsync({ name: accountName, openingBalance: opening });
                    }
                    setAccountName('');
                    setAccountOpening('0');
                    setEditingAccountId(null);
                  }}
                >
                  <Plus aria-hidden /> {editingAccountId ? 'Simpan' : 'Tambah akun'}
                </Button>
                {editingAccountId ? (
                  <Button size="lg" variant="outline" onClick={() => { setEditingAccountId(null); setAccountName(''); }}>
                    Batal
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
          {accounts.isPending ? <LoadingState label="Memuat akun…" /> : null}
          <ul className="flex flex-col gap-2">
            {(accounts.data ?? []).map((account) => (
              <li key={account.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
                <span>
                  <span className="block text-base font-semibold">{account.name}{account.isActive ? '' : ' (nonaktif)'}</span>
                  <span className="block text-sm text-muted-foreground">
                    Saldo awal {formatRupiah(account.openingBalance)} · Saldo kini {formatRupiah(account.balance)}
                  </span>
                </span>
                {canWrite ? (
                  <span className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setEditingAccountId(account.id); setAccountName(account.name); setAccountOpening(String(account.openingBalance)); }}>
                      <Pencil aria-hidden /> Ubah
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void updateAccount.mutateAsync({ id: account.id, input: { isActive: !account.isActive } })}
                    >
                      {account.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                    </Button>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kategori pemasukan &amp; pengeluaran</CardTitle>
          <CardDescription>Kategori nonaktif tidak muncul pada form transaksi baru.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {canWrite ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label className="text-base font-semibold">Nama kategori baru</Label>
                <Input className="min-h-11 text-base" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="cth. Persembahan Syukur" />
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-base font-semibold">Jenis</Label>
                <Select value={categoryType} onValueChange={(value) => setCategoryType(value as TransactionType)}>
                  <SelectTrigger className="min-h-11 w-full text-base"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in" className="text-base">Pemasukan</SelectItem>
                    <SelectItem value="out" className="text-base">Pengeluaran</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Button
                  size="lg"
                  disabled={createCategory.isPending}
                  onClick={async () => {
                    await createCategory.mutateAsync({ name: categoryName, type: categoryType });
                    setCategoryName('');
                  }}
                >
                  <Plus aria-hidden /> Tambah kategori
                </Button>
              </div>
            </div>
          ) : null}
          <ul className="flex flex-col gap-2">
            {(categories.data ?? []).map((category) => (
              <li key={category.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
                <span className="text-base font-semibold">
                  {category.name}
                  <span className="block text-sm font-normal text-muted-foreground">
                    {TRANSACTION_TYPE_LABELS[category.type]}{category.isActive ? '' : ' · nonaktif'}
                  </span>
                </span>
                {canWrite ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void updateCategory.mutateAsync({ id: category.id, input: { isActive: !category.isActive } })}
                  >
                    {category.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

export function ReportSection({
  year,
  month,
  canReport,
  canWrite,
  isAdmin,
}: {
  year: number;
  month: number;
  canReport: boolean;
  canWrite: boolean;
  isAdmin: boolean;
}) {
  const monthly = useMonthlyReport(year, month);
  const yearly = useYearlyReport(year);
  const locks = usePeriodLocks();
  const lock = useLockPeriod();
  const unlock = useUnlockPeriod();
  const monthName = MONTH_NAMES[month - 1];
  const isLocked = (locks.data ?? []).some((item) => item.year === year && item.month === month);
  const failure = lock.error ?? unlock.error;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Laporan {monthName} {year}</CardTitle>
          <CardDescription>
            Dihitung di server dari transaksi aktif. Saldo awal + pemasukan − pengeluaran = saldo akhir.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {failure ? <ErrorAlert message={errorMessage(failure)} /> : null}
          <div className="flex flex-wrap gap-2">
            {canReport ? (
              <>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => void downloadApiFile(`/api/finance/reports/monthly.pdf?year=${year}&month=${month}`, `laporan-${year}-${month}.pdf`)}
                >
                  <FileDown aria-hidden /> Unduh PDF
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => void downloadApiFile(`/api/finance/reports/export.xlsx?year=${year}&month=${month}`, `laporan-${year}-${month}.xlsx`)}
                >
                  <FileSpreadsheet aria-hidden /> Unduh Excel
                </Button>
              </>
            ) : null}
            {canWrite && !isLocked ? (
              <Button
                variant="outline"
                size="lg"
                disabled={lock.isPending}
                onClick={() => { if (window.confirm(`Tutup periode ${monthName} ${year}? Transaksi bulan ini tidak bisa diubah lagi.`)) void lock.mutateAsync({ year, month }); }}
              >
                <Lock aria-hidden /> Tutup periode ini
              </Button>
            ) : null}
            {isLocked ? (
              <span className="flex items-center gap-2">
                <span className="text-base font-semibold">Periode ini sudah ditutup.</span>
                {isAdmin ? (
                  <Button variant="outline" size="lg" disabled={unlock.isPending} onClick={() => void unlock.mutateAsync({ year, month })}>
                    <LockOpen aria-hidden /> Buka kembali (admin)
                  </Button>
                ) : null}
              </span>
            ) : null}
          </div>

          {monthly.isPending ? <LoadingState label="Menghitung laporan…" /> : null}
          {monthly.isError ? <ErrorAlert message={errorMessage(monthly.error)} /> : null}
          {(monthly.data?.accounts ?? []).map((account) => (
            <div key={account.accountId} className="rounded-md border border-border p-4">
              <h3 className="text-lg font-bold">{account.name}</h3>
              <ul className="mt-2 flex flex-col gap-1 text-base">
                <li className="flex justify-between"><span>Saldo awal</span><span>{formatRupiah(account.openingBalance)}</span></li>
                {account.incomeByCategory.map((item) => (
                  <li key={item.categoryId} className="flex justify-between"><span>Pemasukan — {item.name}</span><span>{formatRupiah(item.total)}</span></li>
                ))}
                {account.expenseByCategory.map((item) => (
                  <li key={item.categoryId} className="flex justify-between"><span>Pengeluaran — {item.name}</span><span>{formatRupiah(item.total)}</span></li>
                ))}
                <li className="flex justify-between border-t border-border pt-2 font-bold">
                  <span>Saldo akhir</span><span>{formatRupiah(account.closingBalance)}</span>
                </li>
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ringkasan tahun {year}</CardTitle>
          <CardDescription>Total pemasukan dan pengeluaran per bulan (semua akun).</CardDescription>
        </CardHeader>
        <CardContent>
          {yearly.isPending ? <LoadingState label="Menghitung ringkasan tahun…" /> : null}
          <ul className="flex flex-col gap-1 text-base">
            {(yearly.data?.months ?? []).map((item) => (
              <li key={item.month} className="flex flex-wrap justify-between gap-2 border-b border-border py-2">
                <span className="font-semibold">{MONTH_NAMES[item.month - 1]}</span>
                <span>Masuk {formatRupiah(item.totalIncome)} · Keluar {formatRupiah(item.totalExpense)}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

    </div>
  );
}
