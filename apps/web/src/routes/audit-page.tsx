import { useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { formatDateTime } from '@eklesia/shared';
import { ErrorAlert } from '@/components/feedback/error-alert';
import { LoadingState } from '@/components/feedback/loading-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuditLogs } from '@/features/audit/api';
import { errorMessage } from '@/lib/http';

const ACTION_LABELS: Record<string, string> = {
  'user.invited': 'Mengundang pengguna',
  'user.updated': 'Mengubah pengguna',
  'church.updated': 'Mengubah profil gereja',
  'church.created': 'Mendaftarkan gereja',
  'church.status_changed': 'Mengubah status gereja',
  'password.reset': 'Mengatur ulang password',
  'invitation.accepted': 'Menerima undangan',
};

const ENTITY_LABELS: Record<string, string> = {
  user: 'Pengguna',
  church: 'Gereja',
};

function describe(value: unknown): string {
  if (!value || typeof value !== 'object') {
    return '—';
  }
  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([, item]) => item !== null && item !== undefined,
  );
  if (entries.length === 0) {
    return '—';
  }
  return entries.map(([key, item]) => `${key}: ${String(item)}`).join(', ');
}

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const { data, isPending, isError, error, refetch } = useAuditLogs(page);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Jejak audit</h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Catatan tindakan penting di gereja ini. Catatan tidak dapat dihapus.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Riwayat tindakan</CardTitle>
          <CardDescription>
            {data ? `${data.meta.total} catatan, halaman ${data.meta.page} dari ${data.meta.totalPages}.` : 'Memuat catatan…'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {isPending ? <LoadingState label="Memuat jejak audit…" /> : null}
          {isError ? (
            <div className="flex flex-col gap-3">
              <ErrorAlert message={errorMessage(error)} />
              <Button variant="outline" onClick={() => void refetch()}>
                <RefreshCw aria-hidden />
                Coba lagi
              </Button>
            </div>
          ) : null}

          {data && data.items.length === 0 ? (
            <p className="py-6 text-base text-muted-foreground">Belum ada catatan audit.</p>
          ) : null}

          {data && data.items.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-base">Waktu</TableHead>
                    <TableHead className="text-base">Tindakan</TableHead>
                    <TableHead className="text-base">Jenis</TableHead>
                    <TableHead className="text-base">Sebelum</TableHead>
                    <TableHead className="text-base">Sesudah</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="whitespace-nowrap text-base">
                        {formatDateTime(item.createdAt)}
                      </TableCell>
                      <TableCell className="text-base font-semibold">
                        {ACTION_LABELS[item.action] ?? item.action}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-sm">
                          {ENTITY_LABELS[item.entity] ?? item.entity}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-64 text-sm text-muted-foreground">
                        {describe(item.before)}
                      </TableCell>
                      <TableCell className="max-w-64 text-sm text-muted-foreground">
                        {describe(item.after)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}

          {data && data.meta.totalPages > 1 ? (
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft aria-hidden />
                Sebelumnya
              </Button>
              <span className="text-base text-muted-foreground">
                Halaman {data.meta.page} dari {data.meta.totalPages}
              </span>
              <Button
                variant="outline"
                disabled={page >= data.meta.totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Berikutnya
                <ChevronRight aria-hidden />
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
