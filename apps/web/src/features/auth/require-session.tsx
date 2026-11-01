import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/feedback/loading-state';
import { useSession } from './api';
import { errorMessage } from '@/lib/http';

/**
 * Menjaga seluruh halaman aplikasi. Selama sesi diperiksa tampil status muat,
 * bila belum masuk pengguna diarahkan ke halaman masuk dan dikembalikan ke
 * halaman asal setelah berhasil masuk.
 */
export function RequireSession() {
  const location = useLocation();
  const { data, isPending, isError, error, refetch } = useSession();

  if (isPending) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <LoadingState label="Memeriksa sesi Anda…" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-10">
        <h1 className="text-2xl font-bold">Tidak dapat memeriksa sesi</h1>
        <p className="text-base text-muted-foreground">{errorMessage(error)}</p>
        <Button variant="outline" onClick={() => void refetch()}>
          <RefreshCw aria-hidden />
          Coba lagi
        </Button>
      </div>
    );
  }

  if (!data) {
    return <Navigate to="/masuk" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
