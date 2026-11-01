import type { ReactNode } from 'react';
import { Church, CircleCheck, CircleSlash, RefreshCw, Users } from 'lucide-react';
import { formatDateShort } from '@eklesia/shared';
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
import { CreateChurchDialog } from '@/features/platform/create-church-dialog';
import {
  usePlatformChurches,
  usePlatformSummary,
  useUpdateChurchStatus,
} from '@/features/platform/api';
import { errorMessage } from '@/lib/http';

export default function PlatformPage() {
  const summary = usePlatformSummary();
  const churches = usePlatformChurches();
  const updateStatus = useUpdateChurchStatus();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">Pengelolaan platform</h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Daftarkan gereja baru dan atur statusnya. Data jemaat dan keuangan gereja tidak dapat
            diakses dari halaman ini.
          </p>
        </div>
        <CreateChurchDialog />
      </div>

      <section aria-label="Ringkasan platform" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Total gereja"
          value={summary.data?.totalChurches}
          icon={<Church aria-hidden className="size-6" />}
        />
        <SummaryCard
          title="Gereja aktif"
          value={summary.data?.activeChurches}
          icon={<CircleCheck aria-hidden className="size-6" />}
        />
        <SummaryCard
          title="Gereja nonaktif"
          value={summary.data?.suspendedChurches}
          icon={<CircleSlash aria-hidden className="size-6" />}
        />
        <SummaryCard
          title="Total pengguna"
          value={summary.data?.totalUsers}
          icon={<Users aria-hidden className="size-6" />}
        />
      </section>

      {summary.isError ? <ErrorAlert message={errorMessage(summary.error)} /> : null}
      {updateStatus.isError ? <ErrorAlert message={errorMessage(updateStatus.error)} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Daftar gereja</CardTitle>
          <CardDescription>
            Menonaktifkan gereja menghentikan akses semua penggunanya tanpa menghapus data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {churches.isPending ? <LoadingState label="Memuat daftar gereja…" /> : null}
          {churches.isError ? (
            <div className="flex flex-col gap-3">
              <ErrorAlert message={errorMessage(churches.error)} />
              <Button variant="outline" onClick={() => void churches.refetch()}>
                <RefreshCw aria-hidden />
                Coba lagi
              </Button>
            </div>
          ) : null}

          {churches.data && churches.data.length === 0 ? (
            <p className="py-6 text-base text-muted-foreground">
              Belum ada gereja terdaftar. Gunakan tombol “Daftarkan gereja”.
            </p>
          ) : null}

          {churches.data && churches.data.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-base">Gereja</TableHead>
                    <TableHead className="text-base">Status</TableHead>
                    <TableHead className="text-base">Paket</TableHead>
                    <TableHead className="text-base">Pengguna</TableHead>
                    <TableHead className="text-base">Terdaftar</TableHead>
                    <TableHead className="text-right text-base">Tindakan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {churches.data.map((church) => (
                    <TableRow key={church.id}>
                      <TableCell>
                        <span className="block text-base font-semibold">{church.name}</span>
                        <span className="block font-mono text-sm text-muted-foreground">
                          /{church.slug}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={church.status === 'active' ? 'default' : 'outline'}
                          className="text-sm"
                        >
                          {church.status === 'active' ? 'Aktif' : 'Nonaktif'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-base capitalize">{church.plan}</TableCell>
                      <TableCell className="text-base">{church.userCount}</TableCell>
                      <TableCell className="text-base">{formatDateShort(church.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={updateStatus.isPending}
                            onClick={() =>
                              void updateStatus.mutateAsync({
                                id: church.id,
                                input: {
                                  status: church.status === 'active' ? 'suspended' : 'active',
                                },
                              })
                            }
                          >
                            {church.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number | undefined;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-base font-semibold text-muted-foreground">{title}</CardTitle>
        <span className="text-primary">{icon}</span>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{value ?? '—'}</p>
      </CardContent>
    </Card>
  );
}
