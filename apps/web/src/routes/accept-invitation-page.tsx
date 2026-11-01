import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { z } from 'zod';
import { acceptInvitationSchema, formatDateTime } from '@eklesia/shared';
import { ErrorAlert } from '@/components/feedback/error-alert';
import { LoadingState } from '@/components/feedback/loading-state';
import { TextField } from '@/components/form/text-field';
import { AuthLayout } from '@/components/layout/auth-layout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SESSION_KEY } from '@/features/auth/api';
import { apiClient } from '@/lib/api';
import { errorMessage, toApiError } from '@/lib/http';

type InvitationForm = Omit<z.input<typeof acceptInvitationSchema>, 'token'>;

export default function AcceptInvitationPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const invitation = useQuery({
    queryKey: ['invitation', token],
    enabled: token.length > 0,
    retry: false,
    queryFn: async () => {
      const response = await apiClient.api.auth.invitations[':token'].$get({ param: { token } });
      if (!response.ok) {
        throw await toApiError(response);
      }
      const body = await response.json();
      return body.invitation;
    },
  });

  const form = useForm<InvitationForm>({
    values: invitation.data
      ? { name: invitation.data.name, password: '' }
      : { name: '', password: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const parsed = acceptInvitationSchema.safeParse({ ...values, token });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === 'name' || field === 'password') {
          form.setError(field, { message: issue.message });
        }
      }
      return;
    }
    try {
      const response = await apiClient.api.auth.invitations.accept.$post({ json: parsed.data });
      if (!response.ok) {
        throw await toApiError(response);
      }
      const body = await response.json();
      queryClient.setQueryData(SESSION_KEY, body.profile);
      navigate('/dashboard', { replace: true });
    } catch (caught) {
      setServerError(errorMessage(caught));
    }
  });

  return (
    <AuthLayout
      title="Terima undangan"
      description="Buat password untuk mulai memakai aplikasi gereja Anda."
    >
      <Card>
        <CardContent className="flex flex-col gap-5 pt-6">
          {!token ? (
            <ErrorAlert
              title="Tautan tidak lengkap"
              message="Tautan undangan tidak memuat token. Minta admin gereja mengirim ulang undangan."
            />
          ) : null}

          {invitation.isPending && token ? <LoadingState label="Memeriksa undangan…" /> : null}

          {invitation.isError ? (
            <ErrorAlert title="Undangan tidak dapat dibuka" message={errorMessage(invitation.error)} />
          ) : null}

          {invitation.data ? (
            <>
              <Alert>
                <AlertTitle>Undangan untuk {invitation.data.churchName}</AlertTitle>
                <AlertDescription>
                  <p>Email: {invitation.data.email}</p>
                  <p>Berlaku sampai {formatDateTime(invitation.data.expiresAt)}.</p>
                </AlertDescription>
              </Alert>

              {serverError ? <ErrorAlert message={serverError} /> : null}

              <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
                <TextField
                  label="Nama lengkap"
                  autoComplete="name"
                  error={form.formState.errors.name?.message}
                  {...form.register('name')}
                />
                <TextField
                  label="Password baru"
                  type="password"
                  autoComplete="new-password"
                  hint="Minimal 8 karakter, memuat huruf dan angka."
                  error={form.formState.errors.password?.message}
                  {...form.register('password')}
                />
                <Button
                  type="submit"
                  size="lg"
                  className="w-full text-base"
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? 'Menyimpan…' : 'Aktifkan akun'}
                </Button>
              </form>
            </>
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
