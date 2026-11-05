import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { GROUP_TYPE_LABELS } from '@eklesia/shared';
import { ErrorAlert } from '@/components/feedback/error-alert';
import { LoadingState } from '@/components/feedback/loading-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useGroups } from '@/features/members/api';
import { errorMessage } from '@/lib/http';
import {
  useCreateRole,
  useDeleteRole,
  useServiceRoles,
  useTemplates,
  useUpdateRole,
  useUpdateTemplate,
  type ServiceRoleItem,
} from './api';

const NONE = '__none__';

export function RolesSection({ canWrite }: { canWrite: boolean }) {
  const roles = useServiceRoles();
  const groups = useGroups();
  const create = useCreateRole();
  const update = useUpdateRole();
  const remove = useDeleteRole();
  const [name, setName] = useState('');
  const [groupId, setGroupId] = useState(NONE);
  const [editing, setEditing] = useState<ServiceRoleItem | null>(null);
  const failure = create.error ?? update.error ?? remove.error;

  const groupName = (id: string | null) =>
    id ? (groups.data?.find((group) => group.id === id)?.name ?? '—') : 'Semua tim';

  const submit = async () => {
    if (!name.trim()) return;
    if (editing) {
      await update.mutateAsync({
        id: editing.id,
        input: { name, groupId: groupId === NONE ? null : groupId },
      });
    } else {
      await create.mutateAsync({ name, groupId: groupId === NONE ? undefined : groupId, sortOrder: 0 });
    }
    setName('');
    setGroupId(NONE);
    setEditing(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Peran pelayanan</CardTitle>
        <CardDescription>
          Peran dapat diikat ke satu komisi/tim agar koordinatornya bisa menugaskan dan menyetujui tukar.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {failure ? <ErrorAlert message={errorMessage(failure)} /> : null}
        {canWrite ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-2">
              <Label className="text-base font-semibold">{editing ? 'Ubah peran' : 'Nama peran baru'}</Label>
              <Input
                className="min-h-11 text-base"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="cth. Pemimpin Liturgi / Pemusik / Usher"
              />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label className="text-base font-semibold">Komisi/tim terkait</Label>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger className="min-h-11 w-full text-base"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE} className="text-base">Tidak terikat komisi</SelectItem>
                  {(groups.data ?? []).map((group) => (
                    <SelectItem key={group.id} value={group.id} className="text-base">
                      {group.name} ({GROUP_TYPE_LABELS[group.type]})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button size="lg" onClick={() => void submit()} disabled={create.isPending || update.isPending}>
              <Plus aria-hidden /> {editing ? 'Simpan' : 'Tambah'}
            </Button>
            {editing ? (
              <Button size="lg" variant="outline" onClick={() => { setEditing(null); setName(''); setGroupId(NONE); }}>
                Batal
              </Button>
            ) : null}
          </div>
        ) : null}
        {roles.isPending ? <LoadingState label="Memuat peran…" /> : null}
        {roles.data?.length === 0 ? (
          <p className="text-base text-muted-foreground">Belum ada peran pelayanan.</p>
        ) : null}
        <ul className="flex flex-col gap-2">
          {(roles.data ?? []).map((role) => (
            <li key={role.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
              <span>
                <span className="block text-base font-semibold">{role.name}</span>
                <span className="block text-sm text-muted-foreground">{groupName(role.groupId)}</span>
              </span>
              {canWrite ? (
                <span className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setEditing(role); setName(role.name); setGroupId(role.groupId ?? NONE); }}>
                    <Pencil aria-hidden /> Ubah
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { if (window.confirm(`Hapus peran "${role.name}"?`)) void remove.mutateAsync(role.id); }}
                  >
                    <Trash2 aria-hidden /> Hapus
                  </Button>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function TemplatesSection({ canWrite }: { canWrite: boolean }) {
  const templates = useTemplates();
  const update = useUpdateTemplate();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  return (
    <Card>
      <CardHeader>
        <CardTitle>Template pengingat</CardTitle>
        <CardDescription>
          Gunakan placeholder {'{nama}'}, {'{peran}'}, {'{ibadah}'}, {'{tanggal}'}, {'{jam}'}, {'{lokasi}'}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {update.isError ? <ErrorAlert message={errorMessage(update.error)} /> : null}
        {templates.isPending ? <LoadingState label="Memuat template…" /> : null}
        {(templates.data ?? []).map((template) => (
          <div key={template.channel} className="flex flex-col gap-2">
            <Label htmlFor={`tpl-${template.channel}`} className="text-base font-semibold">
              {template.channel === 'whatsapp' ? 'WhatsApp (tautan wa.me)' : 'Email'}
            </Label>
            <Textarea
              id={`tpl-${template.channel}`}
              rows={4}
              className="text-base"
              disabled={!canWrite}
              value={drafts[template.channel] ?? template.body}
              onChange={(e) => setDrafts((current) => ({ ...current, [template.channel]: e.target.value }))}
            />
            {canWrite ? (
              <div>
                <Button
                  size="lg"
                  disabled={update.isPending}
                  onClick={() =>
                    void update.mutateAsync({
                      channel: template.channel,
                      body: drafts[template.channel] ?? template.body,
                    })
                  }
                >
                  Simpan template {template.channel === 'whatsapp' ? 'WhatsApp' : 'Email'}
                </Button>
              </div>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
