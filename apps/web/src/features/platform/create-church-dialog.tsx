import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { createChurchSchema } from '@eklesia/shared';
import { ErrorAlert } from '@/components/feedback/error-alert';
import { TextField } from '@/components/form/text-field';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { useCreateChurch, type CreateChurchResult } from './api';
import { errorMessage, isApiError } from '@/lib/http';

type CreateForm = z.input<typeof createChurchSchema>;

export function CreateChurchDialog() {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<CreateChurchResult | null>(null);
  const create = useCreateChurch();

  const form = useForm<CreateForm, unknown, z.output<typeof createChurchSchema>>({
    resolver: zodResolver(createChurchSchema),
    defaultValues: {
      name: '',
      slug: '',
      address: '',
      phone: '',
      adminName: '',
      adminEmail: '',
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      setResult(await create.mutateAsync(values));
    } catch (error) {
      if (isApiError(error)) {
        for (const [field, message] of Object.entries(error.fields)) {
          if (
            field === 'name' ||
            field === 'slug' ||
            field === 'address' ||
            field === 'phone' ||
            field === 'adminName' ||
            field === 'adminEmail'
          ) {
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
          form.reset();
          setResult(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="lg" className="text-base">
          Daftarkan gereja
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">Gereja baru</DialogTitle>
          <DialogDescription className="text-base">
            Admin gereja pertama akan menerima undangan untuk membuat password.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="flex flex-col gap-4">
            <Alert>
              <AlertTitle>{result.church.name} sudah terdaftar</AlertTitle>
              <AlertDescription className="flex flex-col gap-2">
                <p>
                  {result.emailSent
                    ? 'Email undangan sudah dikirim ke admin gereja.'
                    : 'Email otomatis belum aktif. Kirim tautan berikut kepada admin gereja.'}
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
            {create.isError ? <ErrorAlert message={errorMessage(create.error)} /> : null}

            <TextField
              label="Nama gereja"
              error={form.formState.errors.name?.message}
              {...form.register('name')}
            />
            <TextField
              label="Slug"
              hint="Huruf kecil, angka, dan tanda hubung. Contoh: gki-contoh."
              error={form.formState.errors.slug?.message}
              {...form.register('slug')}
            />
            <TextField label="Alamat" error={form.formState.errors.address?.message} {...form.register('address')} />
            <TextField
              label="Telepon"
              inputMode="tel"
              error={form.formState.errors.phone?.message}
              {...form.register('phone')}
            />
            <TextField
              label="Nama admin gereja"
              error={form.formState.errors.adminName?.message}
              {...form.register('adminName')}
            />
            <TextField
              label="Email admin gereja"
              type="email"
              inputMode="email"
              error={form.formState.errors.adminEmail?.message}
              {...form.register('adminEmail')}
            />

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" size="lg" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <Button type="submit" size="lg" disabled={create.isPending}>
                {create.isPending ? 'Menyimpan…' : 'Daftarkan'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
