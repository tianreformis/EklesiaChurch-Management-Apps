import { useState } from 'react';
import {
  TRANSACTION_TYPES,
  TRANSACTION_TYPE_LABELS,
  formatRupiah,
  parseRupiahInput,
  type TransactionType,
} from '@eklesia/shared';
import { ErrorAlert } from '@/components/feedback/error-alert';
import { TextField } from '@/components/form/text-field';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { errorMessage } from '@/lib/http';
import {
  uploadAttachment,
  useAccounts,
  useCategories,
  useCreateTransaction,
  useUpdateTransaction,
  type TransactionItem,
} from './api';

function TransactionFormBody({
  transaction,
  onDone,
}: {
  transaction?: TransactionItem | null;
  onDone: () => void;
}) {
  const accounts = useAccounts();
  const categories = useCategories();
  const create = useCreateTransaction();
  const update = useUpdateTransaction();
  const isEdit = Boolean(transaction);
  const mutation = isEdit ? update : create;

  // Komponen ini dipasang ulang setiap dialog dibuka, jadi state awal
  // dapat langsung diambil dari props tanpa effect.
  const [type, setType] = useState<TransactionType>(transaction?.type ?? 'in');
  const [accountId, setAccountId] = useState(transaction?.accountId ?? '');
  const [categoryId, setCategoryId] = useState(transaction?.categoryId ?? '');
  const [amountText, setAmountText] = useState(transaction ? String(transaction.amount) : '');
  const [date, setDate] = useState(transaction?.date ?? new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState(transaction?.description ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const effectiveAccountId = accountId || accounts.data?.[0]?.id || '';
  const visibleCategories = (categories.data ?? []).filter(
    (category) => category.type === type && category.isActive,
  );

  const submit = async () => {
    setLocalError(null);
    const amount = parseRupiahInput(amountText);
    if (!amount || amount <= 0) {
      setLocalError('Nominal harus berupa angka rupiah lebih dari nol, tanpa sen.');
      return;
    }
    if (!effectiveAccountId || !categoryId || !date) {
      setLocalError('Akun kas, kategori, dan tanggal wajib dipilih.');
      return;
    }
    try {
      if (transaction) {
        await update.mutateAsync({
          id: transaction.id,
          input: {
            accountId: effectiveAccountId,
            categoryId,
            type,
            amount,
            date,
            description: description || null,
            serviceId: transaction.serviceId,
          },
        });
        if (file) {
          await uploadAttachment(transaction.id, file);
        }
      } else {
        const created = (await create.mutateAsync({
          accountId: effectiveAccountId,
          categoryId,
          type,
          amount,
          date,
          description: description || undefined,
        })) as { id: string };
        if (file) {
          await uploadAttachment(created.id, file);
        }
      }
      onDone();
    } catch (error) {
      setLocalError(errorMessage(error));
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {localError ? <ErrorAlert message={localError} /> : null}
      {mutation.isError ? <ErrorAlert message={errorMessage(mutation.error)} /> : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label className="text-base font-semibold">Jenis</Label>
          <Select value={type} onValueChange={(value) => { setType(value as TransactionType); setCategoryId(''); }}>
            <SelectTrigger className="min-h-11 w-full text-base"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TRANSACTION_TYPES.map((item) => (
                <SelectItem key={item} value={item} className="text-base">
                  {TRANSACTION_TYPE_LABELS[item]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <TextField label="Tanggal" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      <TextField
        label="Nominal (Rp)"
        inputMode="numeric"
        placeholder="cth. 500000"
        hint={amountText && parseRupiahInput(amountText) ? formatRupiah(parseRupiahInput(amountText)!) : 'Tulis angka saja, tanpa titik/koma.'}
        value={amountText}
        onChange={(e) => setAmountText(e.target.value)}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label className="text-base font-semibold">Akun kas</Label>
          <Select value={effectiveAccountId} onValueChange={setAccountId}>
            <SelectTrigger className="min-h-11 w-full text-base"><SelectValue placeholder="Pilih akun" /></SelectTrigger>
            <SelectContent>
              {(accounts.data ?? []).filter((account) => account.isActive).map((account) => (
                <SelectItem key={account.id} value={account.id} className="text-base">{account.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label className="text-base font-semibold">Kategori</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="min-h-11 w-full text-base"><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
            <SelectContent>
              {visibleCategories.map((category) => (
                <SelectItem key={category.id} value={category.id} className="text-base">{category.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="tx-description" className="text-base font-semibold">Keterangan</Label>
        <Textarea
          id="tx-description"
          rows={2}
          className="text-base"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="tx-attachment" className="text-base font-semibold">
          Bukti (gambar/PDF, maks 2 MB) — opsional
        </Label>
        <input
          id="tx-attachment"
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          className="min-h-11 rounded-md border border-input bg-background px-3 py-2 text-base"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        {transaction?.attachmentFile ? (
          <a
            className="text-base font-semibold underline"
            href={`/api/finance/attachments/${transaction.attachmentFile}`}
            target="_blank"
            rel="noreferrer"
          >
            Lihat bukti yang sudah tersimpan
          </a>
        ) : null}
      </div>

      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" size="lg" onClick={onDone}>
          Batal
        </Button>
        <Button type="button" size="lg" disabled={mutation.isPending} onClick={() => void submit()}>
          {mutation.isPending ? 'Menyimpan…' : isEdit ? 'Simpan perubahan' : 'Catat transaksi'}
        </Button>
      </DialogFooter>
    </div>
  );
}

export function TransactionFormDialog({
  transaction,
  open,
  onOpenChange,
}: {
  transaction?: TransactionItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">{transaction ? 'Ubah transaksi' : 'Catat transaksi'}</DialogTitle>
          <DialogDescription className="text-base">
            Nominal dalam rupiah penuh (tanpa sen). Koreksi transaksi lama sebaiknya memakai
            pembatalan (void), bukan mengubah diam-diam.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <TransactionFormBody
            key={transaction?.id ?? 'baru'}
            transaction={transaction}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
