import { useState } from 'react';
import { MailPlus, Pencil, RefreshCw } from 'lucide-react';
import { ROLE_LABELS, formatDateTime } from '@eklesia/shared';
import type { PublicUser } from '@eklesia/api';
import { ErrorAlert } from '@/components/feedback/error-alert';
import { LoadingState } from '@/components/feedback/loading-state';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EditUserDialog } from '@/features/users/edit-user-dialog';
import { InviteUserDialog } from '@/features/users/invite-user-dialog';
import { useResendInvitation, useUsers, type InviteResult } from '@/features/users/api';
import { errorMessage } from '@/lib/http';

export default function UsersPage() {
  const { data, isPending, isError, error, refetch } = useUsers();
  const resend = useResendInvitation();
  const [editing, setEditing] = useState<PublicUser | null>(null);
  const [resent, setResent] = useState<InviteResult | null>(null);

  const handleResend = async (user: PublicUser) => {
    setResent(null);
    try {
      setResent(await resend.mutateAsync(user.id));
    } catch {
      // Pesan kesalahan ditampilkan lewat resend.error.
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">Pengguna</h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Kelola akun pengurus gereja dan perannya. Setiap peran hanya dapat membuka menu yang
            menjadi tanggung jawabnya.
          </p>
        </div>
        <InviteUserDialog />
      </div>

      {resent ? (
        <Alert>
          <AlertTitle>Undangan baru dibuat</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <p>
              {resent.emailSent
                ? `Email sudah dikirim ke ${resent.user.email}.`
                : 'Email otomatis belum aktif. Kirim tautan berikut secara manual.'}
            </p>
            {resent.inviteUrl ? (
              <span className="break-all rounded-md bg-muted p-2 font-mono text-sm">
                {resent.inviteUrl}
              </span>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {resend.isError ? <ErrorAlert message={errorMessage(resend.error)} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Daftar pengguna</CardTitle>
          <CardDescription>
            {data ? `${data.length} akun terdaftar di gereja ini.` : 'Memuat data…'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isPending ? <LoadingState label="Memuat pengguna…" /> : null}
          {isError ? (
            <div className="flex flex-col gap-3">
              <ErrorAlert message={errorMessage(error)} />
              <Button variant="outline" onClick={() => void refetch()}>
                <RefreshCw aria-hidden />
                Coba lagi
              </Button>
            </div>
          ) : null}

          {data && data.length === 0 ? (
            <p className="py-6 text-base text-muted-foreground">
              Belum ada pengguna lain. Undang pengurus pertama lewat tombol di atas.
            </p>
          ) : null}

          {data && data.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-base">Nama</TableHead>
                    <TableHead className="text-base">Email</TableHead>
                    <TableHead className="text-base">Peran</TableHead>
                    <TableHead className="text-base">Status</TableHead>
                    <TableHead className="text-base">Terakhir masuk</TableHead>
                    <TableHead className="text-right text-base">Tindakan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="text-base font-semibold">{user.name}</TableCell>
                      <TableCell className="text-base">{user.email}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-sm font-semibold">
                          {ROLE_LABELS[user.role]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.isActive ? 'default' : 'outline'} className="text-sm">
                          {user.isActive ? 'Aktif' : 'Nonaktif'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-base">
                        {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Belum pernah'}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          {!user.lastLoginAt && user.isActive ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void handleResend(user)}
                              disabled={resend.isPending}
                            >
                              <MailPlus aria-hidden />
                              Kirim ulang
                            </Button>
                          ) : null}
                          {user.role !== 'admin_gereja' ? (
                            <Button variant="outline" size="sm" onClick={() => setEditing(user)}>
                              <Pencil aria-hidden />
                              Ubah
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <EditUserDialog user={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
