import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { INVITABLE_ROLES, ROLE_LABELS, inviteUserSchema } from '@eklesia/shared';
import { ErrorAlert } from '@/components/feedback/error-alert';
import { TextField } from '@/components/form/text-field';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useInviteUser, type InviteResult } from './api';
import { errorMessage, isApiError } from '@/lib/http';

type InviteForm = z.input<typeof inviteUserSchema>;

export function InviteUserDialog() {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<InviteResult | null>(null);
  const invite = useInviteUser();

  const form = useForm<InviteForm, unknown, z.output<typeof inviteUserSchema>>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues: { name: '', email: '', role: 'pelayan' },
  });

  const reset = () => {
    form.reset({ name: '', email: '', role: 'pelayan' });
    setResult(null);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const created = await invite.mutateAsync(values);
      setResult(created);
    } catch (error) {
      if (isApiError(error)) {
        for (const [field, message] of Object.entries(error.fields)) {
          if (field === 'name' || field === 'email' || field === 'role') {
            form.setError(field, { message });
          }
        }
      }
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="lg" className="text-base">
          Undang pengguna
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">Undang pengguna baru</DialogTitle>
          <DialogDescription className="text-base">
            Pengguna akan menerima tautan untuk membuat password sendiri.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="flex flex-col gap-4">
            <Alert>
              <AlertTitle>Undangan dibuat</AlertTitle>
              <AlertDescription className="flex flex-col gap-2">
                <p>
                  {result.emailSent
                    ? `Email undangan sudah dikirim ke ${result.user.email}.`
                    : 'Email otomatis belum aktif. Kirim tautan berikut kepada pengguna.'}
                </p>
                {result.inviteUrl ? (
                  <span className="break-all rounded-md bg-muted p-2 font-mono text-sm">
                    {result.inviteUrl}
                  </span>
                ) : null}
              </AlertDescription>
            </Alert>
            <DialogFooter>
              <Button size="lg" onClick={() => setOpen(false)}>
                Selesai
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
            {invite.isError ? <ErrorAlert message={errorMessage(invite.error)} /> : null}

            <TextField
              label="Nama lengkap"
              autoComplete="name"
              error={form.formState.errors.name?.message}
              {...form.register('name')}
            />
            <TextField
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="nama@gereja-contoh.id"
              error={form.formState.errors.email?.message}
              {...form.register('email')}
            />

            <div className="flex flex-col gap-2">
              <Label className="text-base font-semibold">Peran</Label>
              <Select
                value={form.watch('role')}
                onValueChange={(value) =>
                  form.setValue('role', value as InviteForm['role'], { shouldValidate: true })
                }
              >
                <SelectTrigger className="min-h-11 w-full text-base">
                  <SelectValue placeholder="Pilih peran" />
                </SelectTrigger>
                <SelectContent>
                  {INVITABLE_ROLES.map((role) => (
                    <SelectItem key={role} value={role} className="text-base">
                      {ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.role ? (
                <p className="text-sm font-semibold text-destructive">
                  {form.formState.errors.role.message}
                </p>
              ) : null}
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" size="lg" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <Button type="submit" size="lg" disabled={invite.isPending}>
                {invite.isPending ? 'Mengirim…' : 'Buat undangan'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
