import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-start gap-4 py-10">
      <p className="text-lg font-semibold text-muted-foreground">404</p>
      <h1 className="text-3xl font-bold">Halaman tidak ditemukan</h1>
      <p className="max-w-xl text-lg text-muted-foreground">
        Alamat yang Anda buka tidak tersedia. Periksa kembali tautannya atau kembali ke dasbor.
      </p>
      <Button asChild>
        <Link to="/dashboard">Kembali ke dasbor</Link>
      </Button>
    </div>
  );
}
