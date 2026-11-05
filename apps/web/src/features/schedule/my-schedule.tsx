import { useState } from 'react';
import { CalendarClock, Check, RefreshCw, Repeat, X } from 'lucide-react';
import {
  ASSIGNMENT_STATUS_LABELS,
  SWAP_STATUS_LABELS,
  formatDateLong,
  hasPermission,
  type Role,
} from '@eklesia/shared';
import { ErrorAlert } from '@/components/feedback/error-alert';
import { LoadingState } from '@/components/feedback/loading-state';
import { Badge } from '@/components/ui/badge';
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
import { useMembers } from '@/features/members/api';
import { errorMessage } from '@/lib/http';
import {
  useApproveSwap,
  useCancelSwap,
  useCreateSwap,
  useMyAssignments,
  useRespondAssignment,
  useRespondSwap,
  useSwaps,
  type MyAssignmentItem,
} from './api';

function SwapDialog({
  assignment,
  memberId,
  onClose,
}: {
  assignment: MyAssignmentItem | null;
  memberId: string | null;
  onClose: () => void;
}) {
  const members = useMembers({ page: 1, perPage: 100 });
  const createSwap = useCreateSwap();
  const [proposed, setProposed] = useState('');

  if (!assignment) {
    return null;
  }

  return (
    <Card className="border-primary">
      <CardHeader>
        <CardTitle>Ajukan tukar jadwal</CardTitle>
        <CardDescription>
          {assignment.title} — {formatDateLong(assignment.date)} · {assignment.roleName}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {createSwap.isError ? <ErrorAlert message={errorMessage(createSwap.error)} /> : null}
        <div className="flex flex-col gap-2">
          <Label className="text-base font-semibold">Pilih pengganti</Label>
          <Select value={proposed} onValueChange={setProposed}>
            <SelectTrigger className="min-h-11 w-full text-base">
              <SelectValue placeholder="Pilih anggota" />
            </SelectTrigger>
            <SelectContent>
              {(members.data?.items ?? [])
                .filter((member) => member.id !== memberId)
                .map((member) => (
                  <SelectItem key={member.id} value={member.id} className="text-base">
                    {member.fullName}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="lg" onClick={onClose}>Batal</Button>
          <Button
            size="lg"
            disabled={!proposed || createSwap.isPending}
            onClick={async () => {
              await createSwap.mutateAsync({ assignmentId: assignment.id, proposedMemberId: proposed, reason: undefined });
              onClose();
            }}
          >
            <Repeat aria-hidden /> Kirim permintaan
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function MyScheduleSection({ role }: { role: Role }) {
  const mine = useMyAssignments();
  const respond = useRespondAssignment();
  const [swapTarget, setSwapTarget] = useState<MyAssignmentItem | null>(null);
  const canSwap = hasPermission(role, 'schedule.swap.request');

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock aria-hidden /> Jadwal saya
          </CardTitle>
          <CardDescription>
            Penugasan pelayanan untuk akun Anda. Konfirmasi atau tolak, dan ajukan tukar bila berhalangan.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {respond.isError ? <ErrorAlert message={errorMessage(respond.error)} /> : null}
          {mine.isPending ? <LoadingState label="Memuat jadwal saya…" /> : null}
          {mine.isError ? (
            <div className="flex flex-col gap-3">
              <ErrorAlert message={errorMessage(mine.error)} />
              <Button variant="outline" onClick={() => void mine.refetch()}>
                <RefreshCw aria-hidden /> Coba lagi
              </Button>
            </div>
          ) : null}
          {mine.data && !mine.data.memberId ? (
            <p className="text-base text-muted-foreground">
              Akun Anda belum terhubung ke data jemaat. Minta admin gereja menghubungkan akun Anda
              agar jadwal pelayanan tampil di sini.
            </p>
          ) : null}
          {mine.data?.items.length === 0 && mine.data.memberId ? (
            <p className="text-base text-muted-foreground">Belum ada penugasan untuk Anda.</p>
          ) : null}
          <ul className="flex flex-col gap-3">
            {(mine.data?.items ?? []).map((item) => (
              <li key={item.id} className="flex flex-col gap-3 rounded-md border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-base font-semibold">
                    {item.title} — {item.roleName}
                  </span>
                  <Badge variant={item.status === 'dikonfirmasi' ? 'default' : 'outline'} className="text-sm">
                    {ASSIGNMENT_STATUS_LABELS[item.status]}
                  </Badge>
                </div>
                <p className="text-base text-muted-foreground">
                  {formatDateLong(item.date)} · {item.startTime}
                  {item.endTime ? `–${item.endTime}` : ''} · {item.location ?? '-'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {item.status === 'menunggu' ? (
                    <>
                      <Button
                        size="lg"
                        disabled={respond.isPending}
                        onClick={() => void respond.mutateAsync({ assignmentId: item.id, status: 'dikonfirmasi' })}
                      >
                        <Check aria-hidden /> Konfirmasi hadir
                      </Button>
                      <Button
                        size="lg"
                        variant="outline"
                        disabled={respond.isPending}
                        onClick={() => void respond.mutateAsync({ assignmentId: item.id, status: 'ditolak' })}
                      >
                        <X aria-hidden /> Tolak
                      </Button>
                    </>
                  ) : null}
                  {canSwap && item.status !== 'ditolak' ? (
                    <Button size="lg" variant="outline" onClick={() => setSwapTarget(item)}>
                      <Repeat aria-hidden /> Ajukan tukar
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <SwapDialog
        assignment={swapTarget}
        memberId={mine.data?.memberId ?? null}
        onClose={() => setSwapTarget(null)}
      />
    </div>
  );
}

export function SwapsSection({ role, memberId }: { role: Role; memberId: string | null }) {
  const swaps = useSwaps();
  const respond = useRespondSwap();
  const approve = useApproveSwap();
  const cancel = useCancelSwap();
  const canApprove = hasPermission(role, 'schedule.swap.approve');
  const failure = respond.error ?? approve.error ?? cancel.error;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Permintaan tukar jadwal</CardTitle>
        <CardDescription>
          Pengganti menjawab lebih dulu, lalu koordinator komisi/admin memberi keputusan akhir.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {failure ? <ErrorAlert message={errorMessage(failure)} /> : null}
        {swaps.isPending ? <LoadingState label="Memuat permintaan tukar…" /> : null}
        {swaps.data?.length === 0 ? (
          <p className="text-base text-muted-foreground">Tidak ada permintaan tukar saat ini.</p>
        ) : null}
        <ul className="flex flex-col gap-3">
          {(swaps.data ?? []).map((swap) => {
            const isProposed = memberId !== null && swap.proposedMemberId === memberId;
            const isRequester = memberId !== null && swap.requestedBy === memberId;
            return (
              <li key={swap.id} className="flex flex-col gap-3 rounded-md border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-base font-semibold">
                    {swap.requesterName} → {swap.proposedName}
                  </span>
                  <Badge variant="outline" className="text-sm">{SWAP_STATUS_LABELS[swap.status]}</Badge>
                </div>
                <p className="text-base text-muted-foreground">
                  {swap.serviceTitle} · {swap.roleName}
                  {swap.serviceDate ? ` · ${formatDateLong(swap.serviceDate)}` : ''}
                  {swap.reason ? ` · Alasan: ${swap.reason}` : ''}
                </p>
                <div className="flex flex-wrap gap-2">
                  {isProposed && swap.status === 'menunggu_pengganti' ? (
                    <>
                      <Button size="lg" disabled={respond.isPending} onClick={() => void respond.mutateAsync({ id: swap.id, accept: true })}>
                        <Check aria-hidden /> Saya bersedia
                      </Button>
                      <Button size="lg" variant="outline" disabled={respond.isPending} onClick={() => void respond.mutateAsync({ id: swap.id, accept: false })}>
                        <X aria-hidden /> Tidak bisa
                      </Button>
                    </>
                  ) : null}
                  {canApprove && swap.status === 'menunggu_koordinator' ? (
                    <>
                      <Button size="lg" disabled={approve.isPending} onClick={() => void approve.mutateAsync({ id: swap.id, accept: true })}>
                        <Check aria-hidden /> Setujui tukar
                      </Button>
                      <Button size="lg" variant="outline" disabled={approve.isPending} onClick={() => void approve.mutateAsync({ id: swap.id, accept: false })}>
                        <X aria-hidden /> Tolak
                      </Button>
                    </>
                  ) : null}
                  {isRequester && (swap.status === 'menunggu_pengganti' || swap.status === 'menunggu_koordinator') ? (
                    <Button size="lg" variant="outline" disabled={cancel.isPending} onClick={() => void cancel.mutateAsync(swap.id)}>
                      Batalkan permintaan
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
