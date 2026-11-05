import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import {
  GENDERS,
  GENDER_LABELS,
  MEMBER_STATUSES,
  MEMBER_STATUS_LABELS,
  createMemberSchema,
  type CreateMemberInput,
  type UpdateMemberInput,
} from '@eklesia/shared';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { errorMessage, isApiError } from '@/lib/http';
import {
  useCreateMember,
  useFamilies,
  useRegions,
  useUpdateMember,
  type MemberDetail,
} from './api';

type MemberForm = z.input<typeof createMemberSchema>;

const NONE = '__none__';

const EMPTY_FORM: MemberForm = {
  fullName: '',
  nickname: '',
  gender: undefined,
  birthDate: '',
  phone: '',
  email: '',
  address: '',
  status: 'aktif',
  familyId: undefined,
  regionId: undefined,
  baptismDate: '',
  sidiDate: '',
  marriageDate: '',
  notes: '',
};

function toForm(member: MemberDetail): MemberForm {
  return {
    fullName: member.fullName,
    nickname: member.nickname ?? '',
    gender: member.gender ?? undefined,
    birthDate: member.birthDate ?? '',
    phone: member.phone ?? '',
    email: member.email ?? '',
    address: member.address ?? '',
    status: member.status,
    familyId: member.familyId ?? undefined,
    regionId: member.regionId ?? undefined,
    baptismDate: member.baptismDate ?? '',
    sidiDate: member.sidiDate ?? '',
    marriageDate: member.marriageDate ?? '',
    notes: member.notes ?? '',
  };
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm font-semibold text-destructive">{message}</p>;
}

export function MemberFormDialog({
  member,
  open,
  onOpenChange,
}: {
  /** Bila terisi, dialog berfungsi sebagai form ubah. */
  member?: MemberDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateMember();
  const update = useUpdateMember();
  const families = useFamilies();
  const regions = useRegions();
  const isEdit = Boolean(member);
  const mutation = isEdit ? update : create;

  const form = useForm<MemberForm, unknown, CreateMemberInput>({
    resolver: zodResolver(createMemberSchema),
    defaultValues: EMPTY_FORM,
  });

  useEffect(() => {
    if (open) {
      form.reset(member ? toForm(member) : EMPTY_FORM);
    }
  }, [open, member, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (member) {
        const input: UpdateMemberInput = {
          fullName: values.fullName,
          nickname: values.nickname,
          gender: values.gender,
          birthDate: values.birthDate,
          phone: values.phone,
          email: values.email,
          address: values.address,
          status: values.status,
          familyId: values.familyId ?? null,
          regionId: values.regionId ?? null,
          baptismDate: values.baptismDate,
          sidiDate: values.sidiDate,
          marriageDate: values.marriageDate,
          notes: values.notes,
        };
        await update.mutateAsync({ id: member.id, input });
      } else {
        await create.mutateAsync(values);
      }
      onOpenChange(false);
    } catch (error) {
      if (isApiError(error)) {
        for (const [field, message] of Object.entries(error.fields)) {
          if (field in EMPTY_FORM) {
            form.setError(field as keyof MemberForm, { message });
          }
        }
      }
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">{isEdit ? 'Ubah data jemaat' : 'Tambah jemaat'}</DialogTitle>
          <DialogDescription className="text-base">
            Isi data pokok jemaat. Kolom bertanda wajib harus diisi; tanggal sakramen boleh dikosongkan.
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
          {mutation.isError ? <ErrorAlert message={errorMessage(mutation.error)} /> : null}

          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label="Nama lengkap *"
              autoComplete="name"
              error={form.formState.errors.fullName?.message}
              {...form.register('fullName')}
            />
            <TextField label="Nama panggilan" {...form.register('nickname')} />
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label className="text-base font-semibold">Jenis kelamin</Label>
              <Select
                value={form.watch('gender') ?? NONE}
                onValueChange={(value) =>
                  form.setValue('gender', value === NONE ? undefined : (value as MemberForm['gender']), {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger className="min-h-11 w-full text-base">
                  <SelectValue placeholder="Pilih" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE} className="text-base">Tidak diisi</SelectItem>
                  {GENDERS.map((gender) => (
                    <SelectItem key={gender} value={gender} className="text-base">
                      {GENDER_LABELS[gender]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={form.formState.errors.gender?.message} />
            </div>
            <TextField label="Tanggal lahir" type="date" {...form.register('birthDate')} />
            <div className="flex flex-col gap-2">
              <Label className="text-base font-semibold">Status</Label>
              <Select
                value={form.watch('status')}
                onValueChange={(value) =>
                  form.setValue('status', value as MemberForm['status'], { shouldValidate: true })
                }
              >
                <SelectTrigger className="min-h-11 w-full text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEMBER_STATUSES.map((status) => (
                    <SelectItem key={status} value={status} className="text-base">
                      {MEMBER_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label="No. HP / WhatsApp"
              inputMode="tel"
              autoComplete="tel"
              placeholder="08xxxxxxxxxx"
              error={form.formState.errors.phone?.message}
              {...form.register('phone')}
            />
            <TextField
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="email"
              error={form.formState.errors.email?.message}
              {...form.register('email')}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="member-address" className="text-base font-semibold">Alamat</Label>
            <Textarea id="member-address" rows={2} className="text-base" {...form.register('address')} />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label className="text-base font-semibold">Keluarga</Label>
              <Select
                value={form.watch('familyId') ?? NONE}
                onValueChange={(value) =>
                  form.setValue('familyId', value === NONE ? undefined : value, { shouldValidate: true })
                }
              >
                <SelectTrigger className="min-h-11 w-full text-base">
                  <SelectValue placeholder="Pilih keluarga" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE} className="text-base">Belum masuk keluarga</SelectItem>
                  {(families.data ?? []).map((family) => (
                    <SelectItem key={family.id} value={family.id} className="text-base">
                      {family.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-base font-semibold">Wilayah</Label>
              <Select
                value={form.watch('regionId') ?? NONE}
                onValueChange={(value) =>
                  form.setValue('regionId', value === NONE ? undefined : value, { shouldValidate: true })
                }
              >
                <SelectTrigger className="min-h-11 w-full text-base">
                  <SelectValue placeholder="Pilih wilayah" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE} className="text-base">Belum masuk wilayah</SelectItem>
                  {(regions.data ?? []).map((region) => (
                    <SelectItem key={region.id} value={region.id} className="text-base">
                      {region.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <TextField label="Tanggal baptis" type="date" {...form.register('baptismDate')} />
            <TextField label="Tanggal sidi" type="date" {...form.register('sidiDate')} />
            <TextField label="Tanggal nikah" type="date" {...form.register('marriageDate')} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="member-notes" className="text-base font-semibold">Catatan</Label>
            <Textarea id="member-notes" rows={2} className="text-base" {...form.register('notes')} />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" size="lg" disabled={mutation.isPending}>
              {mutation.isPending ? 'Menyimpan…' : isEdit ? 'Simpan perubahan' : 'Tambah jemaat'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
