import { Link } from 'react-router-dom';
import { APP_NAME, ROLE_LABELS, hasPermission, type Permission } from '@eklesia/shared';
import { ArrowRight, CalendarDays, Users, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HealthCard } from '@/features/health/health-card';
import { useCurrentProfile } from '@/features/auth/guards';

const quickLinks: { to: string; label: string; description: string; icon: typeof Users; permission: Permission }[] = [
  {
    to: '/jemaat',
    label: 'Data jemaat',
    description: 'Cari anggota, keluarga, dan komisi.',
    icon: Users,
    permission: 'members.read',
  },
  {
    to: '/jadwal',
    label: 'Jadwal pelayanan',
    description: 'Lihat jadwal ibadah dan penugasan.',
    icon: CalendarDays,
    permission: 'schedule.read',
  },
  {
    to: '/keuangan',
    label: 'Keuangan',
    description: 'Catat pemasukan, pengeluaran, dan laporan.',
    icon: Wallet,
    permission: 'finance.read',
  },
];

export default function DashboardPage() {
  const profile = useCurrentProfile();

  if (profile.kind !== 'user') {
    return null;
  }

  const links = quickLinks.filter((link) => hasPermission(profile.user.role, link.permission));
  const firstName = profile.user.name.split(' ')[0] ?? profile.user.name;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <p className="text-base font-semibold text-primary">{profile.church.name}</p>
        <h1 className="text-3xl font-bold">Selamat datang, {firstName}</h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Anda masuk sebagai {ROLE_LABELS[profile.user.role]}. Gunakan menu di atas untuk membuka
          modul yang menjadi tanggung jawab Anda.
        </p>
      </section>

      {links.length > 0 ? (
        <section aria-labelledby="pintasan" className="flex flex-col gap-4">
          <h2 id="pintasan" className="text-2xl font-bold">
            Pintasan
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {links.map((link) => (
              <Card key={link.to}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <link.icon aria-hidden className="size-5 text-primary" />
                    {link.label}
                  </CardTitle>
                  <CardDescription>{link.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" asChild>
                    <Link to={link.to}>
                      Buka
                      <ArrowRight aria-hidden />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Akses Anda</CardTitle>
            <CardDescription>
              Akun Anda belum memiliki akses ke modul jemaat, jadwal, atau keuangan. Hubungi admin
              gereja bila membutuhkan akses tambahan.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <HealthCard />

      <section className="rounded-lg border border-dashed border-border bg-muted/40 p-4">
        <h2 className="text-lg font-semibold">Tentang {APP_NAME}</h2>
        <p className="mt-1 text-base text-muted-foreground">
          Aplikasi ini membantu gereja mengelola jemaat, pelayanan, dan kas dalam satu tempat.
          Modul lain akan aktif secara bertahap dan akan muncul di menu.
        </p>
      </section>
    </div>
  );
}
