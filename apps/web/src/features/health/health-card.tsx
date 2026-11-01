import { CheckCircle2, RefreshCw, TriangleAlert } from 'lucide-react';
import { formatDateTime } from '@eklesia/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useHealth } from '@/features/health/use-health';

/**
 * Status sistem sederhana untuk memastikan API dan database terhubung.
 * Berguna saat pemasangan awal di komputer gereja.
 */
export function HealthCard() {
  const { data, isPending, isError, refetch, isFetching } = useHealth();

  if (isPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Memeriksa status sistem…</CardTitle>
          <CardDescription>Mohon tunggu sebentar.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <TriangleAlert aria-hidden className="size-6" />
            Server tidak dapat dihubungi
          </CardTitle>
          <CardDescription>
            Periksa apakah layanan aplikasi dan database sudah berjalan, lalu coba lagi.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw aria-hidden />
            Coba lagi
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isHealthy = data.status === 'ok' && data.database === 'ok';

  return (
    <Card className={isHealthy ? 'border-emerald-600/40' : 'border-destructive/40'}>
      <CardHeader>
        <CardTitle
          className={
            isHealthy
              ? 'flex items-center gap-2 text-emerald-800'
              : 'flex items-center gap-2 text-destructive'
          }
        >
          {isHealthy ? (
            <CheckCircle2 aria-hidden className="size-6" />
          ) : (
            <TriangleAlert aria-hidden className="size-6" />
          )}
          {isHealthy ? 'Sistem berjalan normal' : 'Database belum siap'}
        </CardTitle>
        <CardDescription>
          {isHealthy
            ? 'Aplikasi dan database terhubung dengan baik.'
            : 'Aplikasi berjalan, tetapi koneksi database gagal. Hubungi administrator.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1 text-base text-muted-foreground">
        <p>
          Aplikasi: <span className="font-semibold text-foreground">{data.app}</span>
        </p>
        <p>Terakhir diperiksa: {formatDateTime(data.checkedAt)}</p>
      </CardContent>
    </Card>
  );
}
