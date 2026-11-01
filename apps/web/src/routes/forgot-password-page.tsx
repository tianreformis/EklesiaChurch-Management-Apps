import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import type { z } from 'zod';
import { forgotPasswordSchema } from '@eklesia/shared';
import { ErrorAlert } from '@/components/feedback/error-alert';
import { TextField } from '@/components/form/text-field';
import { AuthLayout } from '@/components/layout/auth-layout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiClient } from '@/lib/api';
import { errorMessage, toApiError } from '@/lib/http';

type ForgotForm = z.input<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [result, setResult] = useState<{ emailSent: boolean; manualUrl?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ForgotForm, unknown, z.output<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      const response = await apiClient.api.auth['forgot-password'].$post({ json: values });
      if (!response.ok) {
        throw await toApiError(response);
      }
      setResult(await response.json());
    } catch (caught) {
      setError(errorMessage(caught));
    }
  });

  return (
    <AuthLayout
      title="Atur ulang password"
      description="Masukkan email akun Anda. Kami akan mengirim tautan untuk membuat password baru."
    >
      <Card>
        <CardContent className="flex flex-col gap-5 pt-6">
          {result ? (
            <Alert>
              <AlertTitle>Permintaan sudah dicatat</AlertTitle>
              <AlertDescription className="flex flex-col gap-3">
                <p>
                  Bila email tersebut terdaftar, tautan atur ulang password sudah dibuat dan berlaku
                  selama 1 jam.
                </p>
                {result.manualUrl ? (
                  <div className="flex flex-col gap-2">
                    <p className="font-semibold">
                      Email otomatis belum diaktifkan. Kirim tautan berikut kepada pengguna:
                    </p>
                    <Link
                      to={result.manualUrl.replace(/^https?:\/\/[^/]+/, '')}
                      className="break-all font-mono text-sm text-primary underline"
                    >
                      {result.manualUrl}
                    </Link>
                  </div>
                ) : (
                  <p>Silakan periksa kotak masuk email Anda.</p>
                )}
              </AlertDescription>
            </Alert>
          ) : null}

          {error ? <ErrorAlert message={error} /> : null}

          {!result ? (
            <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
              <TextField
                label="Email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="nama@gereja-contoh.id"
                error={form.formState.errors.email?.message}
                {...form.register('email')}
              />
              <Button
                type="submit"
                size="lg"
                className="w-full text-base"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? 'Mengirim…' : 'Kirim tautan'}
              </Button>
            </form>
          ) : null}

          <Link
            to="/masuk"
            className="text-base font-semibold text-primary underline-offset-4 hover:underline"
          >
            Kembali ke halaman masuk
          </Link>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
