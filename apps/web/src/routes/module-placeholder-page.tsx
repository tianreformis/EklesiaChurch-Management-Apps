import { ArrowLeft } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const moduleInfo: Record<string, { title: string; description: string }> = {
  '/jemaat': {
    title: 'Data jemaat',
    description:
      'Pencatatan anggota, keluarga, wilayah, dan komisi akan tersedia pada fase berikutnya.',
  },
  '/jadwal': {
    title: 'Jadwal pelayanan',
    description: 'Kalender ibadah dan penugasan pelayan akan tersedia pada fase berikutnya.',
  },
  '/keuangan': {
    title: 'Keuangan',
    description:
      'Pencatatan kas, persembahan, dan laporan keuangan akan tersedia pada fase berikutnya.',
  },
  '/pengaturan': {
    title: 'Pengaturan',
    description: 'Profil gereja, pengguna, dan peran akan tersedia setelah fitur masuk diaktifkan.',
  },
};

/**
 * Halaman sementara untuk modul yang belum dibangun. Disengaja sederhana dan
 * jelas agar pengguna tidak mengira fiturnya rusak.
 */
export default function ModulePlaceholderPage() {
  const { pathname } = useLocation();
  const info = moduleInfo[pathname] ?? {
    title: 'Halaman',
    description: 'Halaman ini belum tersedia.',
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">{info.title}</h1>
      <Card>
        <CardHeader>
          <CardTitle>Sedang disiapkan</CardTitle>
          <CardDescription>{info.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <Link to="/dashboard">
              <ArrowLeft aria-hidden />
              Kembali ke dasbor
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
