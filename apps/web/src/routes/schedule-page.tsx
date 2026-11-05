import { useMemo, useState } from 'react';
import { Bell, CalendarDays, ChevronLeft, ChevronRight, FileDown, Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  ASSIGNMENT_STATUS_LABELS,
  formatDateLong,
  hasPermission,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCurrentProfile } from '@/features/auth/guards';
import { useMembers } from '@/features/members/api';
import {
  downloadApiFile,
  remindService,
  useCreateAssignment,
  useDeleteAssignment,
  useDeleteService,
  useMyAssignments,
  useServiceDetail,
  useServiceRoles,
  useServices,
  type ReminderItemResult,
  type ServiceItem,
} from '@/features/schedule/api';
import { MyScheduleSection, SwapsSection } from '@/features/schedule/my-schedule';
import { RolesSection, TemplatesSection } from '@/features/schedule/roles-templates';
import { ServiceFormDialog } from '@/features/schedule/service-form-dialog';
import { errorMessage } from '@/lib/http';
import { cn } from '@/lib/utils';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const DAY_NAMES = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function ServiceDetailPanel({
  serviceId,
  canAssign,
  canRemind,
  canWrite,
  onEdit,
}: {
  serviceId: string;
  canAssign: boolean;
  canRemind: boolean;
  canWrite: boolean;
  onEdit: () => void;
}) {
  const detail = useServiceDetail(serviceId);
  const roles = useServiceRoles();
  const members = useMembers({ page: 1, perPage: 100 });
  const createAssignment = useCreateAssignment();
  const deleteAssignment = useDeleteAssignment();
  const deleteService = useDeleteService();
  const [roleId, setRoleId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [reminders, setReminders] = useState<ReminderItemResult[] | null>(null);
  const [reminding, setReminding] = useState(false);
  const failure = createAssignment.error ?? deleteAssignment.error ?? deleteService.error;

  const handleRemind = async (sendEmail: boolean) => {
    setReminding(true);
    try {
      const result = await remindService(serviceId, sendEmail);
      setReminders(result.items);
    } finally {
      setReminding(false);
    }
  };

  if (detail.isPending) {
    return <LoadingState label="Memuat detail ibadah…" />;
  }
  if (detail.isError || !detail.data) {
    return <ErrorAlert message={errorMessage(detail.error)} />;
  }
  const service = detail.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{service.title}</CardTitle>
        <CardDescription>
          {formatDateLong(service.date)} · {service.startTime}
          {service.endTime ? `–${service.endTime}` : ''} · {service.location ?? '-'}
          {service.preacher ? ` · Pelayan firman: ${service.preacher}` : ''}
          {service.theme ? ` · Tema: ${service.theme}` : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {failure ? <ErrorAlert message={errorMessage(failure)} /> : null}
        {warnings.length > 0 ? (
          <div className="rounded-md border border-border bg-muted p-3">
            <p className="text-base font-semibold">Peringatan bentrok:</p>
            <ul className="list-disc pl-6 text-sm">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <ul className="flex flex-col gap-2">
          {service.assignments.length === 0 ? (
            <li className="text-base text-muted-foreground">Belum ada pelayan ditugaskan.</li>
          ) : null}
          {service.assignments.map((assignment) => (
            <li key={assignment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
              <span>
                <span className="block text-base font-semibold">{assignment.roleName}</span>
                <span className="block text-sm text-muted-foreground">
                  {assignment.memberName} · {ASSIGNMENT_STATUS_LABELS[assignment.status]}
                </span>
              </span>
              {canAssign ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { if (window.confirm('Hapus penugasan ini?')) void deleteAssignment.mutateAsync(assignment.id); }}
                >
                  <Trash2 aria-hidden /> Hapus
                </Button>
              ) : null}
            </li>
          ))}
        </ul>

        {canAssign ? (
          <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-2">
              <Label className="text-base font-semibold">Peran</Label>
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger className="min-h-11 w-full text-base"><SelectValue placeholder="Pilih peran" /></SelectTrigger>
                <SelectContent>
                  {(roles.data ?? []).map((role) => (
                    <SelectItem key={role.id} value={role.id} className="text-base">{role.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label className="text-base font-semibold">Pelayan</Label>
              <Select value={memberId} onValueChange={setMemberId}>
                <SelectTrigger className="min-h-11 w-full text-base"><SelectValue placeholder="Pilih anggota" /></SelectTrigger>
                <SelectContent>
                  {(members.data?.items ?? []).map((member) => (
                    <SelectItem key={member.id} value={member.id} className="text-base">{member.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              size="lg"
              disabled={!roleId || !memberId || createAssignment.isPending}
              onClick={async () => {
                const result = await createAssignment.mutateAsync({
                  serviceId,
                  serviceRoleId: roleId,
                  memberId,
                  notes: undefined,
                });
                setWarnings(result.warnings);
              }}
            >
              <Plus aria-hidden /> Tugaskan
            </Button>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          {canRemind ? (
            <>
              <Button size="lg" variant="outline" disabled={reminding} onClick={() => void handleRemind(false)}>
                <Bell aria-hidden /> Siapkan pengingat WhatsApp
              </Button>
              <Button size="lg" variant="outline" disabled={reminding} onClick={() => void handleRemind(true)}>
                <Bell aria-hidden /> Kirim juga via email
              </Button>
            </>
          ) : null}
          {canWrite ? (
            <>
              <Button size="lg" variant="outline" onClick={onEdit}>Ubah ibadah</Button>
              <Button
                size="lg"
                variant="outline"
                disabled={deleteService.isPending}
                onClick={() => { if (window.confirm('Hapus ibadah ini beserta penugasannya?')) void deleteService.mutateAsync(serviceId); }}
              >
                <Trash2 aria-hidden /> Hapus ibadah
              </Button>
            </>
          ) : null}
        </div>

        {reminders ? (
          <div className="flex flex-col gap-2">
            <p className="text-base font-semibold">Pengingat siap dikirim:</p>
            {reminders.length === 0 ? (
              <p className="text-base text-muted-foreground">Belum ada pelayan pada ibadah ini.</p>
            ) : null}
            <ul className="flex flex-col gap-2">
              {reminders.map((item) => (
                <li key={item.assignmentId} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
                  <span>
                    <span className="block text-base font-semibold">{item.memberName} — {item.roleName}</span>
                    <span className="block text-sm text-muted-foreground">
                      {item.emailSent ? 'Email terkirim. ' : ''}{item.waLink ? '' : 'Nomor WhatsApp belum ada.'}
                    </span>
                  </span>
                  {item.waLink ? (
                    <Button asChild size="lg">
                      <a href={item.waLink} target="_blank" rel="noreferrer">Kirim via WhatsApp</a>
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function SchedulePage() {
  const profile = useCurrentProfile();
  const role = profile.kind === 'user' ? profile.user.role : 'jemaat';
  const canWrite = hasPermission(role, 'schedule.write');
  const canAssign = hasPermission(role, 'schedule.assign');
  const canRemind = hasPermission(role, 'schedule.remind');

  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const month = monthKey(cursor);
  const services = useServices(month);
  const mine = useMyAssignments();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingDetail = useServiceDetail(editingId ?? undefined);

  const byDate = useMemo(() => {
    const map = new Map<string, ServiceItem[]>();
    for (const service of services.data ?? []) {
      const list = map.get(service.date) ?? [];
      list.push(service);
      map.set(service.date, list);
    }
    return map;
  }, [services.data]);

  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const mon = cursor.getMonth();
    const firstDay = new Date(year, mon, 1);
    const offset = (firstDay.getDay() + 6) % 7; // Senin sebagai awal pekan.
    const daysInMonth = new Date(year, mon + 1, 0).getDate();
    const result: (string | null)[] = [];
    for (let i = 0; i < offset; i += 1) result.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      result.push(`${year}-${String(mon + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
    }
    return result;
  }, [cursor]);

  const moveMonth = (delta: number) =>
    setCursor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">Jadwal Pelayanan</h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Susun ibadah dan penugasan pelayan, kirim pengingat, dan kelola permintaan tukar.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="lg"
            onClick={() => void downloadApiFile(`/api/schedule/monthly.pdf?month=${month}`, `jadwal-${month}.pdf`)}
          >
            <FileDown aria-hidden /> Unduh PDF bulan ini
          </Button>
          {canWrite ? (
            <Button size="lg" onClick={() => { setEditingId(null); setFormOpen(true); }}>
              <Plus aria-hidden /> Tambah ibadah
            </Button>
          ) : null}
        </div>
      </div>

      <Tabs defaultValue="kalender">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="kalender" className="min-h-11 text-base">Kalender &amp; Penugasan</TabsTrigger>
          <TabsTrigger value="saya" className="min-h-11 text-base">Jadwal Saya</TabsTrigger>
          <TabsTrigger value="tukar" className="min-h-11 text-base">Tukar Jadwal</TabsTrigger>
          <TabsTrigger value="peran" className="min-h-11 text-base">Peran &amp; Template</TabsTrigger>
        </TabsList>

        <TabsContent value="kalender" className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays aria-hidden /> {MONTH_NAMES[cursor.getMonth()]} {cursor.getFullYear()}
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="lg" onClick={() => moveMonth(-1)} aria-label="Bulan sebelumnya">
                    <ChevronLeft aria-hidden />
                  </Button>
                  <Button variant="outline" size="lg" onClick={() => moveMonth(1)} aria-label="Bulan berikutnya">
                    <ChevronRight aria-hidden />
                  </Button>
                </div>
              </div>
              <CardDescription>Klik nama ibadah untuk melihat dan mengatur penugasan.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {services.isPending ? <LoadingState label="Memuat jadwal…" /> : null}
              {services.isError ? (
                <div className="flex flex-col gap-3">
                  <ErrorAlert message={errorMessage(services.error)} />
                  <Button variant="outline" onClick={() => void services.refetch()}>
                    <RefreshCw aria-hidden /> Coba lagi
                  </Button>
                </div>
              ) : null}
              <div className="overflow-x-auto">
                <div className="min-w-[560px]">
                  <div className="grid grid-cols-7 gap-1">
                    {DAY_NAMES.map((day) => (
                      <div key={day} className="p-2 text-center text-sm font-bold">{day}</div>
                    ))}
                    {cells.map((date, index) => (
                      <div key={`${date ?? 'kosong'}-${index}`} className="min-h-20 rounded-md border border-border p-1">
                        {date ? (
                          <>
                            <div className="px-1 text-sm font-semibold">{Number(date.slice(8))}</div>
                            {(byDate.get(date) ?? []).map((service) => (
                              <button
                                key={service.id}
                                type="button"
                                onClick={() => setSelectedId(service.id)}
                                className={cn(
                                  'mt-1 block w-full rounded px-1 py-0.5 text-left text-xs font-semibold',
                                  selectedId === service.id
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-secondary text-secondary-foreground',
                                )}
                              >
                                {service.startTime} {service.title}
                              </button>
                            ))}
                          </>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <h2 className="text-xl font-bold">Daftar ibadah bulan ini</h2>
                {(services.data ?? []).length === 0 && !services.isPending ? (
                  <p className="text-base text-muted-foreground">Belum ada ibadah terjadwal bulan ini.</p>
                ) : null}
                <ul className="flex flex-col gap-2">
                  {(services.data ?? []).map((service) => (
                    <li key={service.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(service.id)}
                        className={cn(
                          'flex w-full flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-left',
                          selectedId === service.id ? 'border-primary bg-secondary' : 'border-border',
                        )}
                      >
                        <span>
                          <span className="block text-base font-semibold">{service.title}</span>
                          <span className="block text-sm text-muted-foreground">
                            {formatDateLong(service.date)} · {service.startTime}
                            {service.endTime ? `–${service.endTime}` : ''} · {service.location ?? '-'}
                          </span>
                        </span>
                        <Badge variant="outline" className="text-sm">
                          {service.assignmentConfirmed}/{service.assignmentTotal} terkonfirmasi
                        </Badge>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          {selectedId ? (
            <ServiceDetailPanel
              serviceId={selectedId}
              canAssign={canAssign}
              canRemind={canRemind}
              canWrite={canWrite}
              onEdit={() => { setEditingId(selectedId); setFormOpen(true); }}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="saya">
          <MyScheduleSection role={role} />
        </TabsContent>
        <TabsContent value="tukar">
          <SwapsSection role={role} memberId={mine.data?.memberId ?? null} />
        </TabsContent>
        <TabsContent value="peran" className="flex flex-col gap-6">
          <RolesSection canWrite={canWrite} />
          <TemplatesSection canWrite={canWrite} />
        </TabsContent>
      </Tabs>

      <ServiceFormDialog
        service={editingId ? (editingDetail.data ?? null) : null}
        open={formOpen}
        onOpenChange={setFormOpen}
      />
    </div>
  );
}
