import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router-dom';
import type { z } from 'zod';
import { resetPasswordSchema } from '@eklesia/shared';
import { ErrorAlert } from '@/components/feedback/error-alert';
import { TextField } from '@/components/form/text-field';
import { AuthLayout } from '@/components/layout/auth-layout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiClient } from '@/lib/api';
import { errorMessage, toApiError } from '@/lib/http';

type ResetForm = Omit<z.input<typeof resetPasswordSchema>, 'token'>;

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ResetForm>({
    defaultValues: { password: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    const parsed = resetPasswordSchema.safeParse({ token, password: values.password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Data belum lengkap.');
      return;
    }
    try {
      const response = await apiClient.api.auth['reset-password'].$post({ json: parsed.data });
      if (!response.ok) {
        throw await toApiError(response);
      }
      setDone(true);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  });

  return (
    <AuthLayout
      title="Buat password baru"
      description="Password minimal 8 karakter dan memuat huruf serta angka."
    >
      <Card>
        <CardContent className="flex flex-col gap-5 pt-6">
          {!token ? (
            <ErrorAlert
              title="Tautan tidak lengkap"
              message="Tautan atur ulang password tidak memuat token. Minta tautan baru dari admin gereja."
            />
          ) : null}

          {done ? (
            <Alert>
              <AlertTitle>Password berhasil diubah</AlertTitle>
              <AlertDescription>
                Semua sesi lama sudah diakhiri. Silakan masuk dengan password baru Anda.
              </AlertDescription>
            </Alert>
          ) : null}

          {error ? <ErrorAlert message={error} /> : null}

          {!done && token ? (
            <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
              <TextField
                label="Password baru"
                type="password"
                autoComplete="new-password"
                error={form.formState.errors.password?.message}
                {...form.register('password', {
                  required: 'Password wajib diisi.',
                  minLength: { value: 8, message: 'Password minimal 8 karakter.' },
                })}
              />
              <Button
                type="submit"
                size="lg"
                className="w-full text-base"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? 'Menyimpan…' : 'Simpan password'}
              </Button>
            </form>
          ) : null}

          <Link
            to="/masuk"
            className="text-base font-semibold text-primary underline-offset-4 hover:underline"
          >
            Ke halaman masuk
          </Link>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
