import { APP_NAME, ROLE_LABELS, hasPermission, type Permission } from '@eklesia/shared';
import {
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  Users,
  UserCog,
  Wallet,
} from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import type { Profile } from '@eklesia/api';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCurrentProfile } from '@/features/auth/guards';
import { useLogout } from '@/features/auth/api';
import { cn } from '@/lib/utils';

interface NavigationItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission?: Permission;
  churchOnly?: boolean;
  platformOnly?: boolean;
}

const navigation: NavigationItem[] = [
  { to: '/dashboard', label: 'Dasbor', icon: LayoutDashboard, churchOnly: true },
  { to: '/jemaat', label: 'Jemaat', icon: Users, permission: 'members.read' },
  { to: '/jadwal', label: 'Jadwal', icon: CalendarDays, permission: 'schedule.read' },
  { to: '/keuangan', label: 'Keuangan', icon: Wallet, permission: 'finance.read' },
  { to: '/pengguna', label: 'Pengguna', icon: UserCog, permission: 'users.manage' },
  { to: '/jejak-audit', label: 'Jejak audit', icon: ClipboardList, permission: 'finance.audit' },
  { to: '/pengaturan', label: 'Pengaturan', icon: Settings, permission: 'church.manage' },
  { to: '/bantuan', label: 'Bantuan', icon: ClipboardList, churchOnly: true },
  { to: '/platform', label: 'Platform', icon: ShieldCheck, platformOnly: true },
];

function isVisible(item: NavigationItem, profile: Profile): boolean {
  if (item.platformOnly) {
    return profile.kind === 'super_admin';
  }
  if (profile.kind !== 'user') {
    return false;
  }
  if (item.churchOnly) {
    return true;
  }
  return item.permission ? hasPermission(profile.user.role, item.permission) : true;
}

export function AppLayout() {
  const profile = useCurrentProfile();
  const logout = useLogout();
  const navigate = useNavigate();

  const items = navigation.filter((item) => isVisible(item, profile));
  const displayName = profile.kind === 'super_admin' ? profile.superAdmin.name : profile.user.name;
  const contextLine =
    profile.kind === 'super_admin'
      ? 'Pengelola platform'
      : `${profile.church.name} · ${ROLE_LABELS[profile.user.role]}`;

  const handleLogout = async () => {
    await logout.mutateAsync();
    navigate('/masuk', { replace: true });
  };

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
            <NavLink
              to={profile.kind === 'super_admin' ? '/platform' : '/dashboard'}
              className="flex items-center gap-3"
            >
              <span
                aria-hidden
                className="flex size-11 items-center justify-center rounded-xl bg-primary text-xl font-black text-primary-foreground"
              >
                E
              </span>
              <span className="flex flex-col">
                <span className="text-xl font-bold leading-tight">{APP_NAME}</span>
                <span className="text-sm text-muted-foreground">{contextLine}</span>
              </span>
            </NavLink>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="min-h-11 gap-2 text-base">
                  <span className="hidden max-w-32 truncate sm:inline">{displayName}</span>
                  <UserCog aria-hidden className="size-5" />
                  <span className="sr-only">Menu akun</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>
                  <span className="block text-base font-semibold">{displayName}</span>
                  <span className="block text-sm font-normal text-muted-foreground">
                    {contextLine}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="min-h-11 text-base"
                  onSelect={() => void handleLogout()}
                  disabled={logout.isPending}
                >
                  <LogOut aria-hidden />
                  {logout.isPending ? 'Sedang keluar…' : 'Keluar'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <nav aria-label="Navigasi utama" className="-mx-1 overflow-x-auto">
            <ul className="flex min-w-max items-center gap-1">
              {items.map((item) => (
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
            {APP_NAME} — aplikasi manajemen gereja. Data jemaat bersifat rahasia; jangan dibagikan
            tanpa izin.
          </p>
          <p className="mt-2 flex flex-wrap gap-4">
            <NavLink to="/bantuan" className="underline underline-offset-2">Panduan</NavLink>
            <NavLink to="/kebijakan-privasi" className="underline underline-offset-2">Kebijakan privasi</NavLink>
            <NavLink to="/syarat-penggunaan" className="underline underline-offset-2">Syarat penggunaan</NavLink>
          </p>
        </div>
      </footer>
    </div>
  );
}
