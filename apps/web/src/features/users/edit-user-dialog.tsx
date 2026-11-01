import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { INVITABLE_ROLES, ROLE_LABELS, updateUserSchema } from '@eklesia/shared';
import type { PublicUser } from '@eklesia/api';
import { ErrorAlert } from '@/components/feedback/error-alert';
import { TextField } from '@/components/form/text-field';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUpdateUser } from './api';
import { errorMessage } from '@/lib/http';

type EditForm = z.input<typeof updateUserSchema>;

export function EditUserDialog({ user, onClose }: { user: PublicUser | null; onClose: () => void }) {
  const update = useUpdateUser();

  const form = useForm<EditForm>({
    resolver: zodResolver(updateUserSchema),
    values: user
      ? {
          name: user.name,
          role: user.role as EditForm['role'],
          isActive: user.isActive,
        }
      : { name: '', role: 'pelayan', isActive: true },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    if (!user) {
      return;
    }
    try {
      await update.mutateAsync({ id: user.id, input: values });
      onClose();
    } catch {
      // Pesan kesalahan ditampilkan di dalam dialog.
    }
  });

  return (
    <Dialog open={Boolean(user)} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">Ubah pengguna</DialogTitle>
          <DialogDescription className="text-base">
            {user ? user.email : ''}
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
          {update.isError ? <ErrorAlert message={errorMessage(update.error)} /> : null}

          <TextField
            label="Nama lengkap"
            error={form.formState.errors.name?.message}
            {...form.register('name')}
          />

          <div className="flex flex-col gap-2">
            <Label className="text-base font-semibold">Peran</Label>
            <Select
              value={form.watch('role')}
              onValueChange={(value) =>
                form.setValue('role', value as EditForm['role'], { shouldValidate: true })
              }
            >
              <SelectTrigger className="min-h-11 w-full text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INVITABLE_ROLES.map((role) => (
                  <SelectItem key={role} value={role} className="text-base">
                    {ROLE_LABELS[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label className="flex items-start gap-3 rounded-md border border-border p-3">
            <Checkbox
              checked={form.watch('isActive')}
              onCheckedChange={(checked) => form.setValue('isActive', checked === true)}
            />
            <span>
              <span className="block text-base font-semibold">Akun aktif</span>
              <span className="block text-sm text-muted-foreground">
                Bila dinonaktifkan, semua sesi pengguna ini langsung diakhiri.
              </span>
            </span>
          </label>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" size="lg" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" size="lg" disabled={update.isPending}>
              {update.isPending ? 'Menyimpan…' : 'Simpan perubahan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
