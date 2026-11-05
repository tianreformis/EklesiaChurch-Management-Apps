import { useState } from 'react';
import { Ban, ChevronLeft, ChevronRight, Paperclip, Pencil, Plus, RefreshCw } from 'lucide-react';
import {
  TRANSACTION_STATUS_LABELS,
  TRANSACTION_TYPES,
  TRANSACTION_TYPE_LABELS,
  formatDateLong,
  formatRupiah,
  hasPermission,
  type TransactionType,
} from '@eklesia/shared';
import { ErrorAlert } from '@/components/feedback/error-alert';
import { LoadingState } from '@/components/feedback/loading-state';
import { Badge } from '@/components/ui/badge';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCurrentProfile } from '@/features/auth/guards';
import {
  useAccounts,
  useCategories,
  useTransactions,
  useVoidTransaction,
  type TransactionItem,
} from '@/features/finance/api';
import {
  AccountsCategoriesSection,
  OfferingSection,
  ReportSection,
} from '@/features/finance/finance-sections';
import { TransactionFormDialog } from '@/features/finance/transaction-form-dialog';
import { errorMessage } from '@/lib/http';

const ALL = '__all__';
const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function monthKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export default function FinancePage() {
  const profile = useCurrentProfile();
  const role = profile.kind === 'user' ? profile.user.role : 'jemaat';
  const canWrite = hasPermission(role, 'finance.write');
  const canVoid = hasPermission(role, 'finance.void');
  const canReport = hasPermission(role, 'finance.report');
  const isAdmin = role === 'admin_gereja';

  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const month = monthKeyOf(cursor);
  const year = cursor.getFullYear();
  const monthNumber = cursor.getMonth() + 1;

  const [accountFilter, setAccountFilter] = useState(ALL);
  const [typeFilter, setTypeFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionItem | null>(null);

  const accounts = useAccounts();
  const categories = useCategories();
  void categories;
  const transactions = useTransactions({
    page,
    perPage: 20,
    month,
    ...(accountFilter !== ALL ? { accountId: accountFilter } : {}),
    ...(typeFilter !== ALL ? { type: typeFilter as TransactionType } : {}),
    ...(statusFilter !== ALL ? { status: statusFilter as 'aktif' | 'void' } : {}),
  });
  const voidTx = useVoidTransaction();

  const totalBalance = (accounts.data ?? []).reduce((sum, account) => sum + account.balance, 0);
  const moveMonth = (delta: number) => {
    setCursor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
    setPage(1);
  };

  const handleVoid = async (transaction: TransactionItem) => {
    const reason = window.prompt(
      `Batalkan transaksi "${transaction.description ?? transaction.categoryName}" (${formatRupiah(transaction.amount)})? Tulis alasan pembatalan:`,
    );
    if (!reason) return;
    await voidTx.mutateAsync({ id: transaction.id, reason });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">Keuangan</h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Catat kas dan persembahan dengan tertib. Transaksi tidak dihapus — koreksi memakai
            pembatalan (void) beralasan.
          </p>
        </div>
        {canWrite ? (
          <Button size="lg" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus aria-hidden /> Catat transaksi
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {(accounts.data ?? []).map((account) => (
          <Card key={account.id}>
            <CardHeader>
              <CardTitle className="text-lg">{account.name}</CardTitle>
              <CardDescription>Saldo saat ini</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatRupiah(account.balance)}</p>
            </CardContent>
          </Card>
        ))}
        {(accounts.data ?? []).length > 1 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Total semua kas</CardTitle>
              <CardDescription>Gabungan akun aktif dan nonaktif</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatRupiah(totalBalance)}</p>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="lg" onClick={() => moveMonth(-1)} aria-label="Bulan sebelumnya">
          <ChevronLeft aria-hidden />
        </Button>
        <p className="text-xl font-bold">
          {MONTH_NAMES[cursor.getMonth()]} {year}
        </p>
        <Button variant="outline" size="lg" onClick={() => moveMonth(1)} aria-label="Bulan berikutnya">
          <ChevronRight aria-hidden />
        </Button>
      </div>

      <Tabs defaultValue="transaksi">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="transaksi" className="min-h-11 text-base">Transaksi</TabsTrigger>
          <TabsTrigger value="persembahan" className="min-h-11 text-base">Persembahan Minggu</TabsTrigger>
          <TabsTrigger value="laporan" className="min-h-11 text-base">Laporan &amp; Periode</TabsTrigger>
          <TabsTrigger value="pengaturan" className="min-h-11 text-base">Akun &amp; Kategori</TabsTrigger>
        </TabsList>

        <TabsContent value="transaksi">
          <Card>
            <CardHeader>
              <CardTitle>Daftar transaksi {MONTH_NAMES[cursor.getMonth()]} {year}</CardTitle>
              <CardDescription>
                {transactions.data ? `${transactions.data.meta.total} transaksi.` : 'Memuat data…'}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {voidTx.isError ? <ErrorAlert message={errorMessage(voidTx.error)} /> : null}
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <div className="flex flex-1 flex-col gap-2">
                  <Label className="text-base font-semibold">Akun kas</Label>
                  <Select value={accountFilter} onValueChange={(value) => { setAccountFilter(value); setPage(1); }}>
                    <SelectTrigger className="min-h-11 w-full text-base"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL} className="text-base">Semua akun</SelectItem>
                      {(accounts.data ?? []).map((account) => (
                        <SelectItem key={account.id} value={account.id} className="text-base">{account.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  <Label className="text-base font-semibold">Jenis</Label>
                  <Select value={typeFilter} onValueChange={(value) => { setTypeFilter(value); setPage(1); }}>
                    <SelectTrigger className="min-h-11 w-full text-base"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL} className="text-base">Masuk &amp; keluar</SelectItem>
                      {TRANSACTION_TYPES.map((type) => (
                        <SelectItem key={type} value={type} className="text-base">{TRANSACTION_TYPE_LABELS[type]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  <Label className="text-base font-semibold">Status</Label>
                  <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>
                    <SelectTrigger className="min-h-11 w-full text-base"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL} className="text-base">Semua status</SelectItem>
                      <SelectItem value="aktif" className="text-base">Aktif</SelectItem>
                      <SelectItem value="void" className="text-base">Dibatalkan (void)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="finance-page-info" className="text-base font-semibold">Halaman</Label>
                  <Input id="finance-page-info" className="min-h-11 text-base" value={String(page)} readOnly aria-label="Halaman saat ini" />
                </div>
              </div>

              {transactions.isPending ? <LoadingState label="Memuat transaksi…" /> : null}
              {transactions.isError ? (
                <div className="flex flex-col gap-3">
                  <ErrorAlert message={errorMessage(transactions.error)} />
                  <Button variant="outline" onClick={() => void transactions.refetch()}>
                    <RefreshCw aria-hidden /> Coba lagi
                  </Button>
                </div>
              ) : null}
              {transactions.data?.items.length === 0 ? (
                <p className="py-6 text-base text-muted-foreground">Belum ada transaksi pada filter ini.</p>
              ) : null}

              {transactions.data && transactions.data.items.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-base">Tanggal</TableHead>
                          <TableHead className="text-base">Kategori</TableHead>
                          <TableHead className="text-base">Akun</TableHead>
                          <TableHead className="text-base">Keterangan</TableHead>
                          <TableHead className="text-right text-base">Nominal</TableHead>
                          <TableHead className="text-base">Status</TableHead>
                          <TableHead className="text-right text-base">Tindakan</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.data.items.map((transaction) => (
                          <TableRow key={transaction.id} className={transaction.status === 'void' ? 'opacity-60' : ''}>
                            <TableCell className="text-base">{formatDateLong(transaction.date)}</TableCell>
                            <TableCell className="text-base font-semibold">{transaction.categoryName}</TableCell>
                            <TableCell className="text-base">{transaction.accountName}</TableCell>
                            <TableCell className="text-base">
                              {transaction.description ?? '—'}
                              {transaction.countedBy ? (
                                <span className="block text-sm text-muted-foreground">
                                  Dihitung: {transaction.countedBy} · Diverifikasi: {transaction.verifiedBy ?? '-'}
                                </span>
                              ) : null}
                              {transaction.voidReason ? (
                                <span className="block text-sm text-muted-foreground">Alasan void: {transaction.voidReason}</span>
                              ) : null}
                            </TableCell>
                            <TableCell className={`text-right text-base font-semibold ${transaction.type === 'in' ? 'text-green-700' : 'text-red-700'}`}>
                              {transaction.type === 'in' ? '+' : '−'} {formatRupiah(transaction.amount)}
                            </TableCell>
                            <TableCell>
                              <Badge variant={transaction.status === 'aktif' ? 'default' : 'outline'} className="text-sm">
                                {TRANSACTION_STATUS_LABELS[transaction.status]}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-2">
                                {transaction.attachmentFile ? (
                                  <Button asChild variant="outline" size="sm">
                                    <a href={`/api/finance/attachments/${transaction.attachmentFile}`} target="_blank" rel="noreferrer">
                                      <Paperclip aria-hidden /> Bukti
                                    </a>
                                  </Button>
                                ) : null}
                                {canWrite && transaction.status === 'aktif' ? (
                                  <Button variant="outline" size="sm" onClick={() => { setEditing(transaction); setFormOpen(true); }}>
                                    <Pencil aria-hidden /> Ubah
                                  </Button>
                                ) : null}
                                {canVoid && transaction.status === 'aktif' ? (
                                  <Button variant="outline" size="sm" disabled={voidTx.isPending} onClick={() => void handleVoid(transaction)}>
                                    <Ban aria-hidden /> Batalkan
                                  </Button>
                                ) : null}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-base text-muted-foreground">
                      Halaman {transactions.data.meta.page} dari {transactions.data.meta.totalPages}
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="lg" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                        Sebelumnya
                      </Button>
                      <Button
                        variant="outline"
                        size="lg"
                        disabled={page >= transactions.data.meta.totalPages}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        Berikutnya
                      </Button>
                    </div>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="persembahan">
          <OfferingSection canWrite={canWrite} monthKey={month} />
        </TabsContent>
        <TabsContent value="laporan">
          <ReportSection year={year} month={monthNumber} canReport={canReport} canWrite={canWrite} isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="pengaturan">
          <AccountsCategoriesSection canWrite={canWrite} />
        </TabsContent>
      </Tabs>

      <TransactionFormDialog
        transaction={editing}
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
      />
    </div>
  );
}
