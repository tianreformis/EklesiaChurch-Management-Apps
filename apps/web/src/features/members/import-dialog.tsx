import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FileSpreadsheet, Upload } from 'lucide-react';
import type { ImportAction, ImportPreviewRow } from '@eklesia/shared';
import { ErrorAlert } from '@/components/feedback/error-alert';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { errorMessage } from '@/lib/http';
import {
  confirmMemberImport,
  downloadApiFile,
  previewMemberImport,
  type ImportResult,
} from './api';

const MAX_BYTES = 5 * 1024 * 1024;

type Step = 'pilih' | 'pratinjau' | 'selesai';

function rowStatus(row: ImportPreviewRow): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  if (row.duplicateOf) return { label: 'Duplikat', variant: 'secondary' };
  if (row.errors.length > 0) return { label: 'Perlu diperbaiki', variant: 'destructive' };
  return { label: 'Siap', variant: 'default' };
}

export function ImportMembersDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('pilih');
  const [rows, setRows] = useState<ImportPreviewRow[]>([]);
  const [choices, setChoices] = useState<Record<number, ImportAction>>({});
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const reset = () => {
    setStep('pilih');
    setRows([]);
    setChoices({});
    setResult(null);
    setFailure(null);
    setBusy(false);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setFailure(null);
    if (file.size > MAX_BYTES) {
      setFailure('Berkas terlalu besar. Maksimal 5 MB.');
      return;
    }
    setBusy(true);
    try {
      const preview = await previewMemberImport(file);
      setRows(preview.rows);
      setChoices(
        Object.fromEntries(preview.rows.map((row) => [row.rowNumber, row.action])),
      );
      setStep('pratinjau');
    } catch (error) {
      setFailure(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async () => {
    setBusy(true);
    setFailure(null);
    try {
      const confirmed = await confirmMemberImport(
        rows,
        Object.entries(choices).map(([rowNumber, action]) => ({
          rowNumber: Number(rowNumber),
          action,
        })),
      );
      setResult(confirmed);
      setStep('selesai');
      await queryClient.invalidateQueries({ queryKey: ['members'] });
    } catch (error) {
      setFailure(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const readyCount = rows.filter((row) => !row.duplicateOf && row.errors.length === 0).length;
  const duplicateCount = rows.filter((row) => row.duplicateOf).length;
  const brokenCount = rows.filter((row) => !row.duplicateOf && row.errors.length > 0).length;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Impor data jemaat dari Excel</DialogTitle>
          <DialogDescription className="text-base">
            Unduh template, isi data, lalu unggah. Periksa pratinjau dulu — data tidak akan
            tertimpa tanpa konfirmasi Anda.
          </DialogDescription>
        </DialogHeader>

        {failure ? <ErrorAlert message={failure} /> : null}

        {step === 'pilih' ? (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                variant="outline"
                size="lg"
                onClick={() => void downloadApiFile('/api/members-import/template', 'template-impor-jemaat.xlsx')}
              >
                <FileSpreadsheet aria-hidden />
                Unduh template Excel
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="import-file" className="text-base font-semibold">
                Berkas Excel (.xlsx, maks 5 MB, maks 5.000 baris)
              </Label>
              <input
                id="import-file"
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="min-h-11 rounded-md border border-input bg-background px-3 py-2 text-base"
                onChange={(event) => void handleFile(event.target.files?.[0])}
                disabled={busy}
              />
              <p className="text-sm text-muted-foreground">
                {busy ? 'Memeriksa berkas…' : 'Setelah berkas dipilih, pratinjau akan tampil sebelum data disimpan.'}
              </p>
            </div>
          </div>
        ) : null}

        {step === 'pratinjau' ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <Badge className="text-sm">{readyCount} siap diimpor</Badge>
              <Badge variant="secondary" className="text-sm">{duplicateCount} duplikat</Badge>
              <Badge variant="destructive" className="text-sm">{brokenCount} perlu diperbaiki</Badge>
            </div>
            <p className="text-base text-muted-foreground">
              Baris duplikat bisa dilewati atau dipakai untuk memperbarui data lama. Baris yang
              perlu diperbaiki akan dilewati; perbaiki di Excel lalu impor ulang bila perlu.
            </p>
            <div className="max-h-[50vh] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-base">Baris</TableHead>
                    <TableHead className="text-base">Nama</TableHead>
                    <TableHead className="text-base">Status</TableHead>
                    <TableHead className="text-base">Keterangan</TableHead>
                    <TableHead className="text-base">Pilihan duplikat</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const status = rowStatus(row);
                    return (
                      <TableRow key={row.rowNumber}>
                        <TableCell className="text-base">{row.rowNumber}</TableCell>
                        <TableCell className="text-base font-semibold">{row.data.fullName || '—'}</TableCell>
                        <TableCell>
                          <Badge variant={status.variant} className="text-sm">{status.label}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{row.errors.join(' ') || '—'}</TableCell>
                        <TableCell>
                          {row.duplicateOf ? (
                            <Select
                              value={choices[row.rowNumber] ?? 'skip'}
                              onValueChange={(value) =>
                                setChoices((current) => ({
                                  ...current,
                                  [row.rowNumber]: value as ImportAction,
                                }))
                              }
                            >
                              <SelectTrigger className="min-h-11 w-40 text-base">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="skip" className="text-base">Lewati</SelectItem>
                                <SelectItem value="update" className="text-base">Perbarui data lama</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" size="lg" onClick={() => setStep('pilih')}>
                Pilih berkas lain
              </Button>
              <Button type="button" size="lg" onClick={() => void handleConfirm()} disabled={busy}>
                <Upload aria-hidden />
                {busy ? 'Mengimpor…' : 'Konfirmasi impor'}
              </Button>
            </DialogFooter>
          </div>
        ) : null}

        {step === 'selesai' && result ? (
          <div className="flex flex-col gap-4">
            <Alert>
              <AlertTitle>Impor selesai</AlertTitle>
              <AlertDescription className="text-base">
                {result.created} anggota baru ditambahkan, {result.updated} diperbarui,{' '}
                {result.skipped} dilewati.
              </AlertDescription>
            </Alert>
            {result.errors.length > 0 ? (
              <div className="flex flex-col gap-2">
                <p className="text-base font-semibold">Laporan baris yang dilewati:</p>
                <ul className="list-disc pl-6 text-sm">
                  {result.errors.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <DialogFooter>
              <Button size="lg" onClick={() => onOpenChange(false)}>Selesai</Button>
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
