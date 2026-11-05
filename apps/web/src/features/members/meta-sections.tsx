import { useState } from 'react';
import { Pencil, Plus, Trash2, Users } from 'lucide-react';
import { GROUP_TYPES, GROUP_TYPE_LABELS } from '@eklesia/shared';
import { ErrorAlert } from '@/components/feedback/error-alert';
import { LoadingState } from '@/components/feedback/loading-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { errorMessage } from '@/lib/http';
import {
  useCreateFamily,
  useCreateGroup,
  useCreateRegion,
  useDeleteFamily,
  useDeleteGroup,
  useDeleteRegion,
  useFamilies,
  useGroupMembers,
  useGroups,
  useMembers,
  useRegions,
  useSetGroupMembers,
  useUpdateFamily,
  useUpdateGroup,
  useUpdateRegion,
  type GroupItem,
} from './api';

const NONE = '__none__';

interface SectionProps {
  canWrite: boolean;
}

function NameRow({
  name,
  meta,
  canWrite,
  onEdit,
  onDelete,
}: {
  name: string;
  meta: string;
  canWrite: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
      <span>
        <span className="block text-base font-semibold">{name}</span>
        <span className="block text-sm text-muted-foreground">{meta}</span>
      </span>
      {canWrite ? (
        <span className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil aria-hidden /> Ubah
          </Button>
          <Button variant="outline" size="sm" onClick={onDelete}>
            <Trash2 aria-hidden /> Hapus
          </Button>
        </span>
      ) : null}
    </li>
  );
}

export function FamiliesSection({ canWrite }: SectionProps) {
  const families = useFamilies();
  const members = useMembers({ page: 1, perPage: 100 });
  const create = useCreateFamily();
  const update = useUpdateFamily();
  const remove = useDeleteFamily();
  const [name, setName] = useState('');
  const [headId, setHeadId] = useState(NONE);
  const [editingId, setEditingId] = useState<string | null>(null);
  const failure = create.error ?? update.error ?? remove.error;

  const submit = async () => {
    if (!name.trim()) return;
    if (editingId) {
      await update.mutateAsync({ id: editingId, input: { name, headMemberId: headId === NONE ? null : headId } });
    } else {
      await create.mutateAsync({ name, headMemberId: headId === NONE ? undefined : headId });
    }
    setName('');
    setHeadId(NONE);
    setEditingId(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Keluarga</CardTitle>
        <CardDescription>Satu keluarga dapat berisi banyak anggota, dengan satu kepala keluarga.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {failure ? <ErrorAlert message={errorMessage(failure)} /> : null}
        {canWrite ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-2">
              <Label className="text-base font-semibold">{editingId ? 'Ubah nama keluarga' : 'Nama keluarga baru'}</Label>
              <Input className="min-h-11 text-base" value={name} onChange={(e) => setName(e.target.value)} placeholder="cth. Keluarga Simanjuntak" />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label className="text-base font-semibold">Kepala keluarga</Label>
              <Select value={headId} onValueChange={setHeadId}>
                <SelectTrigger className="min-h-11 w-full text-base"><SelectValue placeholder="Pilih anggota" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE} className="text-base">Belum ditentukan</SelectItem>
                  {(members.data?.items ?? []).map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-base">{m.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button size="lg" onClick={() => void submit()} disabled={create.isPending || update.isPending}>
              <Plus aria-hidden /> {editingId ? 'Simpan' : 'Tambah'}
            </Button>
            {editingId ? (
              <Button size="lg" variant="outline" onClick={() => { setEditingId(null); setName(''); setHeadId(NONE); }}>Batal</Button>
            ) : null}
          </div>
        ) : null}
        {families.isPending ? <LoadingState label="Memuat keluarga…" /> : null}
        {families.data?.length === 0 ? <p className="text-base text-muted-foreground">Belum ada keluarga.</p> : null}
        <ul className="flex flex-col gap-2">
          {(families.data ?? []).map((family) => (
            <NameRow
              key={family.id}
              name={family.name}
              meta={`${family.memberCount} anggota`}
              canWrite={canWrite}
              onEdit={() => { setEditingId(family.id); setName(family.name); setHeadId(family.headMemberId ?? NONE); }}
              onDelete={() => { if (window.confirm(`Hapus keluarga "${family.name}"? Anggota tidak ikut terhapus.`)) void remove.mutateAsync(family.id); }}
            />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function RegionsSection({ canWrite }: SectionProps) {
  const regions = useRegions();
  const create = useCreateRegion();
  const update = useUpdateRegion();
  const remove = useDeleteRegion();
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const failure = create.error ?? update.error ?? remove.error;

  const submit = async () => {
    if (!name.trim()) return;
    if (editingId) await update.mutateAsync({ id: editingId, input: { name } });
    else await create.mutateAsync({ name });
    setName('');
    setEditingId(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wilayah / kelompok sel</CardTitle>
        <CardDescription>Satu anggota hanya masuk ke satu wilayah.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {failure ? <ErrorAlert message={errorMessage(failure)} /> : null}
        {canWrite ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-2">
              <Label className="text-base font-semibold">{editingId ? 'Ubah nama wilayah' : 'Nama wilayah baru'}</Label>
              <Input className="min-h-11 text-base" value={name} onChange={(e) => setName(e.target.value)} placeholder="cth. Wilayah 1 — Cibubur" />
            </div>
            <Button size="lg" onClick={() => void submit()} disabled={create.isPending || update.isPending}>
              <Plus aria-hidden /> {editingId ? 'Simpan' : 'Tambah'}
            </Button>
            {editingId ? <Button size="lg" variant="outline" onClick={() => { setEditingId(null); setName(''); }}>Batal</Button> : null}
          </div>
        ) : null}
        {regions.isPending ? <LoadingState label="Memuat wilayah…" /> : null}
        {regions.data?.length === 0 ? <p className="text-base text-muted-foreground">Belum ada wilayah.</p> : null}
        <ul className="flex flex-col gap-2">
          {(regions.data ?? []).map((region) => (
            <NameRow
              key={region.id}
              name={region.name}
              meta={`${region.memberCount} anggota`}
              canWrite={canWrite}
              onEdit={() => { setEditingId(region.id); setName(region.name); }}
              onDelete={() => { if (window.confirm(`Hapus wilayah "${region.name}"? Anggota tidak ikut terhapus.`)) void remove.mutateAsync(region.id); }}
            />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function GroupsSection({ canWrite, onManage }: SectionProps & { onManage: (group: GroupItem) => void }) {
  const groups = useGroups();
  const create = useCreateGroup();
  const update = useUpdateGroup();
  const remove = useDeleteGroup();
  const [name, setName] = useState('');
  const [type, setType] = useState<string>('komisi');
  const [editingId, setEditingId] = useState<string | null>(null);
  const failure = create.error ?? update.error ?? remove.error;

  const submit = async () => {
    if (!name.trim()) return;
    if (editingId) await update.mutateAsync({ id: editingId, input: { name, type: type as GroupItem['type'], description: undefined } });
    else await create.mutateAsync({ name, type: type as GroupItem['type'], description: undefined });
    setName('');
    setEditingId(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Komisi &amp; tim pelayanan</CardTitle>
        <CardDescription>Satu anggota bisa ikut banyak komisi/tim sekaligus.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {failure ? <ErrorAlert message={errorMessage(failure)} /> : null}
        {canWrite ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-2">
              <Label className="text-base font-semibold">{editingId ? 'Ubah nama' : 'Nama komisi/tim baru'}</Label>
              <Input className="min-h-11 text-base" value={name} onChange={(e) => setName(e.target.value)} placeholder="cth. Paduan Suara / Tim Multimedia" />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-base font-semibold">Jenis</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="min-h-11 w-full text-base"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GROUP_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="text-base">{GROUP_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button size="lg" onClick={() => void submit()} disabled={create.isPending || update.isPending}>
              <Plus aria-hidden /> {editingId ? 'Simpan' : 'Tambah'}
            </Button>
            {editingId ? <Button size="lg" variant="outline" onClick={() => { setEditingId(null); setName(''); }}>Batal</Button> : null}
          </div>
        ) : null}
        {groups.isPending ? <LoadingState label="Memuat komisi…" /> : null}
        {groups.data?.length === 0 ? <p className="text-base text-muted-foreground">Belum ada komisi/tim.</p> : null}
        <ul className="flex flex-col gap-2">
          {(groups.data ?? []).map((group) => (
            <li key={group.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
              <span>
                <span className="block text-base font-semibold">{group.name}</span>
                <span className="block text-sm text-muted-foreground">
                  {GROUP_TYPE_LABELS[group.type]} · {group.memberCount} anggota
                </span>
              </span>
              <span className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => onManage(group)}>
                  <Users aria-hidden /> Atur anggota
                </Button>
                {canWrite ? (
                  <>
                    <Button variant="outline" size="sm" onClick={() => { setEditingId(group.id); setName(group.name); setType(group.type); }}>
                      <Pencil aria-hidden /> Ubah
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { if (window.confirm(`Hapus "${group.name}"?`)) void remove.mutateAsync(group.id); }}>
                      <Trash2 aria-hidden /> Hapus
                    </Button>
                  </>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function GroupMembersDialog({
  group,
  canWrite,
  onClose,
}: {
  group: GroupItem | null;
  canWrite: boolean;
  onClose: () => void;
}) {
  const current = useGroupMembers(group?.id);
  const allMembers = useMembers({ page: 1, perPage: 100 });
  const save = useSetGroupMembers();
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');

  const currentIds = new Set((current.data ?? []).map((m) => m.id));
  const isChecked = (id: string) => overrides[id] ?? currentIds.has(id);
  const selectedIds = (allMembers.data?.items ?? [])
    .map((m) => m.id)
    .filter((id) => isChecked(id));

  const visible = (allMembers.data?.items ?? []).filter((m) =>
    m.fullName.toLowerCase().includes(search.toLowerCase()),
  );

  const toggle = (id: string, checked: boolean) =>
    setOverrides((prev) => ({ ...prev, [id]: checked }));

  return (
    <Dialog open={Boolean(group)} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">Anggota {group?.name ?? ''}</DialogTitle>
          <DialogDescription className="text-base">
            Centang anggota yang tergabung. Perubahan berlaku setelah disimpan.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {save.isError ? <ErrorAlert message={errorMessage(save.error)} /> : null}
          <Input
            className="min-h-11 text-base"
            placeholder="Cari nama anggota…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Cari nama anggota"
          />
          {current.isPending || allMembers.isPending ? <LoadingState label="Memuat anggota…" /> : null}
          <ul className="flex max-h-[45vh] flex-col gap-2 overflow-auto">
            {visible.map((m) => (
              <li key={m.id}>
                <label className="flex items-center gap-3 rounded-md border border-border p-3">
                  <Checkbox
                    checked={isChecked(m.id)}
                    disabled={!canWrite}
                    onCheckedChange={(checked) => toggle(m.id, checked === true)}
                  />
                  <span className="text-base font-semibold">{m.fullName}</span>
                  <span className="text-sm text-muted-foreground">{m.phone ?? ''}</span>
                </label>
              </li>
            ))}
          </ul>
          {visible.length === 0 && !allMembers.isPending ? (
            <p className="text-base text-muted-foreground">Tidak ada anggota yang cocok.</p>
          ) : null}
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" size="lg" onClick={onClose}>Tutup</Button>
          {canWrite ? (
            <Button
              size="lg"
              disabled={save.isPending || !group}
              onClick={async () => {
                if (!group) return;
                await save.mutateAsync({ groupId: group.id, input: { memberIds: selectedIds } });
                onClose();
              }}
            >
              {save.isPending ? 'Menyimpan…' : `Simpan (${selectedIds.length} anggota)`}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
