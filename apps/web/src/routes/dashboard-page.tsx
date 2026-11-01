import { APP_NAME } from '@eklesia/shared';
import { HealthCard } from '@/features/health/health-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const upcomingModules = [
  {
    title: 'Data jemaat',
    description:
      'Daftar anggota, keluarga, wilayah, dan komisi. Termasuk impor dari Excel dengan pratinjau.',
  },
  {
    title: 'Jadwal pelayanan',
    description:
      'Jadwal ibadah, penugasan pelayan, konfirmasi kehadiran, dan pengajuan tukar jadwal.',
  },
  {
    title: 'Keuangan',
    description: 'Kas, kategori, transaksi, persembahan Minggu, laporan bulanan, dan audit log.',
  },
] as const;

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Selamat datang di {APP_NAME}</h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Satu tempat untuk mengelola jemaat, pelayanan, dan kas gereja. Aplikasi ini sedang
          disiapkan secara bertahap; modul yang aktif akan muncul di menu.
        </p>
      </section>

      <HealthCard />

      <section aria-labelledby="modul-berikutnya" className="flex flex-col gap-4">
        <h2 id="modul-berikutnya" className="text-2xl font-bold">
          Modul yang sedang disiapkan
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {upcomingModules.map((module) => (
            <Card key={module.title}>
              <CardHeader>
                <CardTitle>{module.title}</CardTitle>
                <CardDescription>{module.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-base font-semibold text-muted-foreground">Segera hadir</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
