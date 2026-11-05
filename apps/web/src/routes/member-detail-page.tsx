import { useState } from 'react';
import { ArrowLeft, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  GENDER_LABELS,
  MEMBER_STATUS_LABELS,
  formatDateLong,
  formatDateTime,
  hasPermission,
} from '@eklesia/shared';
import { ErrorAlert } from '@/components/feedback/error-alert';
import { LoadingState } from '@/components/feedback/loading-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrentProfile } from '@/features/auth/guards';
import { useDeleteMember, useMember } from '@/features/members/api';
import { MemberFormDialog } from '@/features/members/member-form-dialog';
import { errorMessage } from '@/lib/http';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border py-3 sm:flex-row sm:justify-between">
      <span className="text-base font-semibold">{label}</span>
      <span className="text-base text-muted-foreground">{value || '—'}</span>
    </div>
  );
}

function longDate(value: string | null): string {
  return value ? formatDateLong(value) : '—';
}

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const profile = useCurrentProfile();
  const role = profile.kind === 'user' ? profile.user.role : 'jemaat';
  const canWrite = hasPermission(role, 'members.write');
  const member = useMember(id);
  const remove = useDeleteMember();
  const [editOpen, setEditOpen] = useState(false);

  const handleDelete = async () => {
    if (!id || !member.data) return;
    if (!window.confirm(`Hapus data "${member.data.fullName}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    await remove.mutateAsync(id);
    navigate('/jemaat');
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button asChild variant="outline" size="lg">
          <Link to="/jemaat">
            <ArrowLeft aria-hidden /> Kembali ke daftar
          </Link>
        </Button>
      </div>

      {member.isPending ? <LoadingState label="Memuat detail anggota…" /> : null}
      {member.isError ? (
        <div className="flex flex-col gap-3">
          <ErrorAlert message={errorMessage(member.error)} />
          <Button variant="outline" onClick={() => void member.refetch()}>
            <RefreshCw aria-hidden /> Coba lagi
          </Button>
        </div>
      ) : null}

      {member.data ? (
        <>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl font-bold">{member.data.fullName}</h1>
              <p className="text-lg text-muted-foreground">
                {member.data.nickname ? `${member.data.nickname} · ` : ''}
                <Badge variant={member.data.status === 'aktif' ? 'default' : 'outline'} className="text-sm">
                  {MEMBER_STATUS_LABELS[member.data.status]}
                </Badge>
              </p>
            </div>
            {canWrite ? (
              <div className="flex flex-wrap gap-2">
                <Button size="lg" onClick={() => setEditOpen(true)}>
                  <Pencil aria-hidden /> Ubah data
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  disabled={remove.isPending}
                  onClick={() => void handleDelete()}
                >
                  <Trash2 aria-hidden /> Hapus
                </Button>
              </div>
            ) : null}
          </div>

          {remove.isError ? <ErrorAlert message={errorMessage(remove.error)} /> : null}

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Data pokok</CardTitle></CardHeader>
              <CardContent>
                <Row label="Jenis kelamin" value={member.data.gender ? GENDER_LABELS[member.data.gender] : '—'} />
                <Row label="Tanggal lahir" value={longDate(member.data.birthDate)} />
                <Row label="No. HP / WhatsApp" value={member.data.phone ?? '—'} />
                <Row label="Email" value={member.data.email ?? '—'} />
                <Row label="Alamat" value={member.data.address ?? '—'} />
                <Row label="Keluarga" value={member.data.family?.name ?? '—'} />
                <Row label="Wilayah" value={member.data.region?.name ?? '—'} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Status gerejawi &amp; catatan</CardTitle></CardHeader>
              <CardContent>
                <Row label="Tanggal baptis" value={longDate(member.data.baptismDate)} />
                <Row label="Tanggal sidi" value={longDate(member.data.sidiDate)} />
                <Row label="Tanggal nikah" value={longDate(member.data.marriageDate)} />
                <Row label="Catatan" value={member.data.notes ?? '—'} />
                <Row label="Terakhir diubah" value={formatDateTime(member.data.updatedAt)} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Komisi &amp; tim yang diikuti</CardTitle></CardHeader>
            <CardContent>
              {member.data.groups.length === 0 ? (
                <p className="text-base text-muted-foreground">Belum tergabung dalam komisi/tim.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {member.data.groups.map((group) => (
                    <Badge key={group.id} variant="secondary" className="text-sm font-semibold">
                      {group.name}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <MemberFormDialog member={member.data} open={editOpen} onOpenChange={setEditOpen} />
        </>
      ) : null}
    </div>
  );
}
