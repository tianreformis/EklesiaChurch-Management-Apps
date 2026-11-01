import { APP_NAME } from '@eklesia/shared';
import { CalendarDays, LayoutDashboard, Settings, Users, Wallet } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils';

const navigation = [
  { to: '/dashboard', label: 'Dasbor', icon: LayoutDashboard },
  { to: '/jemaat', label: 'Jemaat', icon: Users },
  { to: '/jadwal', label: 'Jadwal', icon: CalendarDays },
  { to: '/keuangan', label: 'Keuangan', icon: Wallet },
  { to: '/pengaturan', label: 'Pengaturan', icon: Settings },
] as const;

export function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a
        href="#konten"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:text-base focus:font-semibold"
      >
        Lompat ke konten utama
      </a>

      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <NavLink to="/dashboard" className="flex items-center gap-3">
              <span
                aria-hidden
                className="flex size-11 items-center justify-center rounded-xl bg-primary text-xl font-black text-primary-foreground"
              >
                E
              </span>
              <span className="flex flex-col">
                <span className="text-xl font-bold leading-tight">{APP_NAME}</span>
                <span className="text-sm text-muted-foreground">
                  Kelola jemaat, pelayanan, dan kas gereja
                </span>
              </span>
            </NavLink>
          </div>

          <nav aria-label="Navigasi utama" className="-mx-1 overflow-x-auto">
            <ul className="flex min-w-max items-center gap-1">
              {navigation.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        'flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-base font-semibold transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-foreground hover:bg-secondary',
                      )
                    }
                  >
                    <item.icon aria-hidden className="size-5" />
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      <main id="konten" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto w-full max-w-6xl px-4 py-4 text-sm text-muted-foreground sm:px-6">
          <p>
            {APP_NAME} · Aplikasi manajemen gereja. Data jemaat bersifat rahasia; jangan dibagikan
            tanpa izin.
          </p>
        </div>
      </footer>
    </div>
  );
}
