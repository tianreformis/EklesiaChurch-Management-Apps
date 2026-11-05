import { Link } from 'react-router-dom';
import {
  APP_NAME,
  ROLE_LABELS,
  formatDateLong,
  formatRupiah,
  hasPermission,
  type Permission,
} from '@eklesia/shared';
import { ArrowRight, Cake, CalendarDays, ClipboardList, Users, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HealthCard } from '@/features/health/health-card';
import { useCurrentProfile } from '@/features/auth/guards';
import { useAccounts } from '@/features/finance/api';
import { useBirthdays } from '@/features/members/api';
import { useMyAssignments, useServices } from '@/features/schedule/api';

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

function monthKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function UpcomingServicesCard() {
  const services = useServices(monthKeyOf(new Date()));
  const upcoming = (services.data ?? [])
    .filter((service) => service.date >= todayKey())
    .slice(0, 3);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays aria-hidden className="size-5 text-primary" /> Ibadah terdekat
        </CardTitle>
        <CardDescription>Ibadah bulan ini yang belum lewat.</CardDescription>
      </CardHeader>
      <CardContent>
        {upcoming.length === 0 ? (
          <p className="text-base text-muted-foreground">Belum ada ibadah terjadwal bulan ini.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {upcoming.map((service) => (
              <li key={service.id} className="text-base">
                <span className="font-semibold">{service.title}</span>
                <span className="block text-sm text-muted-foreground">
                  {formatDateLong(service.date)} · {service.startTime} · {service.assignmentConfirmed}/
                  {service.assignmentTotal} pelayan terkonfirmasi
                </span>
              </li>
            ))}
          </ul>
        )}
        <Button variant="outline" className="mt-4" asChild>
          <Link to="/jadwal">Buka jadwal <ArrowRight aria-hidden /></Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function MyScheduleCard() {
  const mine = useMyAssignments();
  const upcoming = (mine.data?.items ?? [])
    .filter((item) => item.date >= todayKey())
    .slice(0, 3);
  if (mine.data && !mine.data.memberId) {
    return null;
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList aria-hidden className="size-5 text-primary" /> Tugas saya berikutnya
        </CardTitle>
        <CardDescription>Penugasan pelayanan untuk akun Anda.</CardDescription>
      </CardHeader>
      <CardContent>
        {upcoming.length === 0 ? (
          <p className="text-base text-muted-foreground">Tidak ada penugasan mendatang.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {upcoming.map((item) => (
              <li key={item.id} className="text-base">
                <span className="font-semibold">{item.roleName} — {item.title}</span>
                <span className="block text-sm text-muted-foreground">
                  {formatDateLong(item.date)} · {item.startTime}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Button variant="outline" className="mt-4" asChild>
          <Link to="/jadwal">Konfirmasi di Jadwal Saya <ArrowRight aria-hidden /></Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function CashCard() {
  const accounts = useAccounts();
  const total = (accounts.data ?? []).reduce((sum, account) => sum + account.balance, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet aria-hidden className="size-5 text-primary" /> Saldo kas
        </CardTitle>
        <CardDescription>Dari transaksi aktif semua akun.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{formatRupiah(total)}</p>
        <ul className="mt-2 flex flex-col gap-1">
          {(accounts.data ?? []).map((account) => (
            <li key={account.id} className="flex justify-between text-base">
              <span>{account.name}</span>
              <span className="font-semibold">{formatRupiah(account.balance)}</span>
            </li>
          ))}
        </ul>
        <Button variant="outline" className="mt-4" asChild>
          <Link to="/keuangan">Buka keuangan <ArrowRight aria-hidden /></Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function BirthdaysCard() {
  const month = new Date().getMonth() + 1;
  const birthdays = useBirthdays(month);
  const items = (birthdays.data?.items ?? []).slice(0, 5);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cake aria-hidden className="size-5 text-primary" /> Ulang tahun bulan ini
        </CardTitle>
        <CardDescription>Sapa dan doakan jemaat yang berulang tahun.</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-base text-muted-foreground">Tidak ada ulang tahun bulan ini.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <li key={item.id} className="text-base">
                <span className="font-semibold">{item.fullName}</span>
                <span className="block text-sm text-muted-foreground">
                  {item.birthDate ? formatDateLong(item.birthDate) : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Button variant="outline" className="mt-4" asChild>
          <Link to="/jemaat">Buka data jemaat <ArrowRight aria-hidden /></Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const profile = useCurrentProfile();

  if (profile.kind !== 'user') {
    return null;
  }

  const role = profile.user.role;
  const links = quickLinks.filter((link) => hasPermission(role, link.permission));
  const firstName = profile.user.name.split(' ')[0] ?? profile.user.name;
  const canSchedule = hasPermission(role, 'schedule.read');
  const canFinance = hasPermission(role, 'finance.read');
  const canMembers = hasPermission(role, 'members.read');

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <p className="text-base font-semibold text-primary">{profile.church.name}</p>
        <h1 className="text-3xl font-bold">Selamat datang, {firstName}</h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Anda masuk sebagai {ROLE_LABELS[role]}. Ringkasan berikut disesuaikan dengan
          tanggung jawab Anda.
        </p>
      </section>

      <section aria-label="Ringkasan peran" className="grid gap-4 md:grid-cols-2">
        {canSchedule ? <UpcomingServicesCard /> : null}
        {canSchedule ? <MyScheduleCard /> : null}
        {canFinance ? <CashCard /> : null}
        {canMembers ? <BirthdaysCard /> : null}
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
          Panduan singkat tersedia di halaman Bantuan pada menu Pengaturan.
        </p>
      </section>
    </div>
  );
}
