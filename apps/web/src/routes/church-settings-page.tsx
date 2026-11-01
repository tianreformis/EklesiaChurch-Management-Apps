import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { updateChurchSchema } from '@eklesia/shared';
import { ErrorAlert } from '@/components/feedback/error-alert';
import { LoadingState } from '@/components/feedback/loading-state';
import { TextField } from '@/components/form/text-field';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useChurch, useUpdateChurch } from '@/features/church/api';
import { errorMessage, isApiError } from '@/lib/http';

type ChurchForm = z.input<typeof updateChurchSchema>;

const TIMEZONES = [
  { value: 'Asia/Jakarta', label: 'WIB — Asia/Jakarta' },
  { value: 'Asia/Makassar', label: 'WITA — Asia/Makassar' },
  { value: 'Asia/Jayapura', label: 'WIT — Asia/Jayapura' },
] as const;

export default function ChurchSettingsPage() {
  const { data, isPending, isError, error } = useChurch();
  const update = useUpdateChurch();
  const [saved, setSaved] = useState(false);

  const form = useForm<ChurchForm, unknown, z.output<typeof updateChurchSchema>>({
    resolver: zodResolver(updateChurchSchema),
    values: data
      ? {
          name: data.name,
          address: data.address ?? '',
          phone: data.phone ?? '',
          timezone: data.timezone,
        }
      : { name: '', address: '', phone: '', timezone: 'Asia/Jakarta' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSaved(false);
    try {
      await update.mutateAsync(values);
      setSaved(true);
    } catch (caught) {
      if (isApiError(caught)) {
        for (const [field, message] of Object.entries(caught.fields)) {
          if (field === 'name' || field === 'address' || field === 'phone') {
            form.setError(field, { message });
          }
        }
      }
    }
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Pengaturan gereja</h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Data ini tampil pada undangan dan laporan. Perubahan dicatat di jejak audit.
        </p>
      </div>

      {isPending ? <LoadingState label="Memuat profil gereja…" /> : null}
      {isError ? <ErrorAlert message={errorMessage(error)} /> : null}

      {data ? (
        <Card>
          <CardHeader>
            <CardTitle>Profil gereja</CardTitle>
            <CardDescription>
              Alamat aplikasi: <span className="font-mono text-sm">/{data.slug}</span> · Paket:{' '}
              {data.plan}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex max-w-2xl flex-col gap-5" onSubmit={onSubmit} noValidate>
              {saved ? (
                <Alert>
                  <AlertTitle>Perubahan tersimpan</AlertTitle>
                  <AlertDescription>Profil gereja sudah diperbarui.</AlertDescription>
                </Alert>
              ) : null}
              {update.isError ? <ErrorAlert message={errorMessage(update.error)} /> : null}

              <TextField
                label="Nama gereja"
                autoComplete="organization"
                error={form.formState.errors.name?.message}
                {...form.register('name')}
              />

              <div className="flex flex-col gap-2">
                <Label htmlFor="alamat" className="text-base font-semibold">
                  Alamat
                </Label>
                <textarea
                  id="alamat"
                  rows={3}
                  className="min-h-24 rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  {...form.register('address')}
                />
                {form.formState.errors.address ? (
                  <p className="text-sm font-semibold text-destructive">
                    {form.formState.errors.address.message}
                  </p>
                ) : null}
              </div>

              <TextField
                label="Nomor telepon"
                inputMode="tel"
                autoComplete="tel"
                hint="Boleh dikosongkan."
                error={form.formState.errors.phone?.message}
                {...form.register('phone')}
              />

              <div className="flex flex-col gap-2">
                <Label className="text-base font-semibold">Zona waktu</Label>
                <Select
                  value={form.watch('timezone')}
                  onValueChange={(value) =>
                    form.setValue('timezone', value, { shouldValidate: true })
                  }
                >
                  <SelectTrigger className="min-h-11 w-full text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((zone) => (
                      <SelectItem key={zone.value} value={zone.value} className="text-base">
                        {zone.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Button type="submit" size="lg" disabled={update.isPending}>
                  {update.isPending ? 'Menyimpan…' : 'Simpan perubahan'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
