import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { createServiceSchema, type CreateServiceInput } from '@eklesia/shared';
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
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { errorMessage, isApiError } from '@/lib/http';
import { useCreateService, useUpdateService, type ServiceDetail } from './api';

type ServiceForm = z.input<typeof createServiceSchema>;

const EMPTY_FORM: ServiceForm = {
  title: '',
  date: '',
  startTime: '09:00',
  endTime: '',
  location: '',
  theme: '',
  preacher: '',
  notes: '',
  recurrenceWeeks: 1,
};

export function ServiceFormDialog({
  service,
  open,
  onOpenChange,
}: {
  service?: ServiceDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateService();
  const update = useUpdateService();
  const isEdit = Boolean(service);
  const mutation = isEdit ? update : create;

  const form = useForm<ServiceForm, unknown, CreateServiceInput>({
    resolver: zodResolver(createServiceSchema),
    defaultValues: EMPTY_FORM,
  });

  useEffect(() => {
    if (open) {
      form.reset(
        service
          ? {
              title: service.title,
              date: service.date,
              startTime: service.startTime,
              endTime: service.endTime ?? '',
              location: service.location ?? '',
              theme: service.theme ?? '',
              preacher: service.preacher ?? '',
              notes: service.notes ?? '',
              recurrenceWeeks: 1,
            }
          : EMPTY_FORM,
      );
    }
  }, [open, service, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (service) {
        await update.mutateAsync({
          id: service.id,
          input: {
            title: values.title,
            date: values.date,
            startTime: values.startTime,
            endTime: values.endTime || null,
            location: values.location ?? null,
            theme: values.theme ?? null,
            preacher: values.preacher ?? null,
            notes: values.notes ?? null,
          },
        });
      } else {
        await create.mutateAsync(values);
      }
      onOpenChange(false);
    } catch (error) {
      if (isApiError(error)) {
        for (const [field, message] of Object.entries(error.fields)) {
          if (field in EMPTY_FORM) {
            form.setError(field as keyof ServiceForm, { message });
          }
        }
      }
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">{isEdit ? 'Ubah ibadah' : 'Tambah ibadah'}</DialogTitle>
          <DialogDescription className="text-base">
            Ibadah rutin dapat dibuat berulang mingguan; ibadah khusus cukup dibuat sekali.
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
          {mutation.isError ? <ErrorAlert message={errorMessage(mutation.error)} /> : null}

          <TextField
            label="Nama ibadah *"
            placeholder="cth. Ibadah Minggu Pagi / Natal"
            error={form.formState.errors.title?.message}
            {...form.register('title')}
          />
          <div className="grid gap-5 sm:grid-cols-3">
            <TextField label="Tanggal *" type="date" error={form.formState.errors.date?.message} {...form.register('date')} />
            <TextField label="Jam mulai *" type="time" {...form.register('startTime')} />
            <TextField label="Jam selesai" type="time" {...form.register('endTime')} />
          </div>
          <TextField label="Lokasi" placeholder="cth. Gedung Utama" {...form.register('location')} />
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField label="Tema" {...form.register('theme')} />
            <TextField label="Pengkhotbah" {...form.register('preacher')} />
          </div>
          {!isEdit ? (
            <TextField
              label="Berulang mingguan (kali)"
              type="number"
              min={1}
              max={52}
              hint="Isi 4 untuk membuat jadwal sebulan sekaligus. Ibadah khusus: biarkan 1."
              {...form.register('recurrenceWeeks')}
            />
          ) : null}
          <div className="flex flex-col gap-2">
            <Label htmlFor="service-notes" className="text-base font-semibold">Catatan</Label>
            <Textarea id="service-notes" rows={2} className="text-base" {...form.register('notes')} />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" size="lg" disabled={mutation.isPending}>
              {mutation.isPending ? 'Menyimpan…' : isEdit ? 'Simpan perubahan' : 'Tambah ibadah'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
