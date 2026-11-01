import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { z } from 'zod';
import { loginSchema } from '@eklesia/shared';
import { ErrorAlert } from '@/components/feedback/error-alert';
import { TextField } from '@/components/form/text-field';
import { AuthLayout } from '@/components/layout/auth-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useLogin, useSession } from '@/features/auth/api';
import { errorMessage, isApiError } from '@/lib/http';

type LoginForm = z.input<typeof loginSchema>;

export default function LoginPage() {
  const login = useLogin();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: existing } = useSession();

  const form = useForm<LoginForm, unknown, z.output<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    if (existing) {
      navigate(existing.kind === 'super_admin' ? '/platform' : '/dashboard', { replace: true });
    }
  }, [existing, navigate]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const profile = await login.mutateAsync(values);
      const from = (location.state as { from?: string } | null)?.from;
      const target =
        profile.kind === 'super_admin' ? '/platform' : (from ?? '/dashboard');
      navigate(target, { replace: true });
    } catch (error) {
      if (isApiError(error)) {
        for (const [field, message] of Object.entries(error.fields)) {
          if (field === 'email' || field === 'password') {
            form.setError(field, { message });
          }
        }
      }
    }
  });

  return (
    <AuthLayout
      title="Selamat datang kembali"
      description="Masuk untuk mengelola jemaat, jadwal pelayanan, dan kas gereja."
    >
      <Card>
        <CardContent className="pt-6">
          <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
            {login.isError ? <ErrorAlert message={errorMessage(login.error)} /> : null}

            <TextField
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="nama@gereja-contoh.id"
              error={form.formState.errors.email?.message}
              {...form.register('email')}
            />

            <TextField
              label="Password"
              type="password"
              autoComplete="current-password"
              error={form.formState.errors.password?.message}
              {...form.register('password')}
            />

            <Button type="submit" size="lg" className="w-full text-base" disabled={login.isPending}>
              {login.isPending ? 'Sedang masuk…' : 'Masuk'}
            </Button>

            <div className="flex flex-col gap-2 text-base">
              <Link to="/lupa-password" className="font-semibold text-primary underline-offset-4 hover:underline">
                Lupa password?
              </Link>
              <p className="text-muted-foreground">
                Belum punya akun? Hubungi admin gereja Anda untuk mendapat undangan.
              </p>
            </div>
          </form>
        </CardContent>
      </Card>

      {import.meta.env.DEV ? <DemoAccounts onFill={(email) => form.setValue('email', email)} /> : null}
    </AuthLayout>
  );
}

function DemoAccounts({ onFill }: { onFill: (email: string) => void }) {
  const accounts = [
    ['Admin gereja', 'admin@gki-contoh.test'],
    ['Bendahara', 'bendahara@gki-contoh.test'],
    ['Majelis', 'majelis@gki-contoh.test'],
    ['Admin gereja kedua', 'admin@gpdi-contoh.test'],
    ['Pengelola platform', 'platform@eklesia.test'],
  ] as const;

  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/50 p-4 text-sm">
      <p className="font-semibold">Akun demo (lingkungan pengembangan)</p>
      <p className="mt-1 text-muted-foreground">
        Password semua akun: <span className="font-mono font-semibold">Eklesia2026</span>
      </p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {accounts.map(([label, email]) => (
          <li key={email}>
            <Button type="button" variant="outline" size="sm" onClick={() => onFill(email)}>
              {label}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
