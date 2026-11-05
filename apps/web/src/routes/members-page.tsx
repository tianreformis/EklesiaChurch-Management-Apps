import { useState } from 'react';
import { Cake, Download, RefreshCw, Search, Upload, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  MEMBER_STATUSES,
  MEMBER_STATUS_LABELS,
  formatDateLong,
  hasPermission,
  type MemberStatus,
} from '@eklesia/shared';
import { ErrorAlert } from '@/components/feedback/error-alert';
import { LoadingState } from '@/components/feedback/loading-state';
import { Badge } from '@/components/ui/badge';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCurrentProfile } from '@/features/auth/guards';
import {
  downloadApiFile,
  useBirthdays,
  useGroups,
  useMembers,
  useRegions,
  type GroupItem,
} from '@/features/members/api';
import { ImportMembersDialog } from '@/features/members/import-dialog';
import { MemberFormDialog } from '@/features/members/member-form-dialog';
import {
  FamiliesSection,
  GroupMembersDialog,
  GroupsSection,
  RegionsSection,
} from '@/features/members/meta-sections';
import { errorMessage } from '@/lib/http';

const ALL = '__all__';
const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const PER_PAGE = 20;

export default function MembersPage() {
  const profile = useCurrentProfile();
  const role = profile.kind === 'user' ? profile.user.role : 'jemaat';
  const canWrite = hasPermission(role, 'members.write');
  const canImport = hasPermission(role, 'members.import');
  const canExport = hasPermission(role, 'members.export');

  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [status, setStatus] = useState<string>(ALL);
  const [regionId, setRegionId] = useState<string>(ALL);
  const [groupId, setGroupId] = useState<string>(ALL);
  const [birthMonth, setBirthMonth] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [managingGroup, setManagingGroup] = useState<GroupItem | null>(null);

  const regions = useRegions();
  const groups = useGroups();
  const filter = {
    page,
    perPage: PER_PAGE,
    ...(submittedSearch ? { search: submittedSearch } : {}),
    ...(status !== ALL ? { status: status as MemberStatus } : {}),
    ...(regionId !== ALL ? { regionId } : {}),
    ...(groupId !== ALL ? { groupId } : {}),
    ...(birthMonth !== ALL ? { birthMonth: Number(birthMonth) } : {}),
  };
  const members = useMembers(filter);
  const currentMonth = new Date().getMonth() + 1;
  const birthdays = useBirthdays(currentMonth);

  const resetPage = () => setPage(1);

  const handleExport = () => {
    const params = new URLSearchParams();
    if (status !== ALL) params.set('status', status);
    if (regionId !== ALL) params.set('regionId', regionId);
    const query = params.toString();
    void downloadApiFile(`/api/members-import/export${query ? `?${query}` : ''}`, 'data-jemaat.xlsx');
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">Data Jemaat</h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Kelola anggota, keluarga, wilayah, dan komisi/tim. Data ini rahasia — jangan dibagikan
            tanpa izin.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canImport ? (
            <Button variant="outline" size="lg" onClick={() => setImportOpen(true)}>
              <Upload aria-hidden /> Impor Excel
            </Button>
          ) : null}
          {canExport ? (
            <Button variant="outline" size="lg" onClick={handleExport}>
              <Download aria-hidden /> Ekspor Excel
            </Button>
          ) : null}
          {canWrite ? (
            <Button size="lg" onClick={() => setFormOpen(true)}>
              <UserPlus aria-hidden /> Tambah jemaat
            </Button>
          ) : null}
        </div>
      </div>

      <Tabs defaultValue="anggota">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="anggota" className="min-h-11 text-base">Anggota</TabsTrigger>
          <TabsTrigger value="keluarga" className="min-h-11 text-base">Keluarga</TabsTrigger>
          <TabsTrigger value="wilayah" className="min-h-11 text-base">Wilayah</TabsTrigger>
          <TabsTrigger value="komisi" className="min-h-11 text-base">Komisi &amp; Tim</TabsTrigger>
        </TabsList>

        <TabsContent value="anggota" className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cake aria-hidden /> Ulang tahun bulan {MONTHS[currentMonth - 1]}
              </CardTitle>
              <CardDescription>Anggota aktif yang berulang tahun bulan ini.</CardDescription>
            </CardHeader>
            <CardContent>
              {birthdays.isPending ? <LoadingState label="Memuat ulang tahun…" /> : null}
              {birthdays.data && birthdays.data.items.length === 0 ? (
                <p className="text-base text-muted-foreground">Tidak ada ulang tahun bulan ini.</p>
              ) : null}
              {birthdays.data && birthdays.data.items.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {birthdays.data.items.map((item) => (
                    <li key={item.id} className="flex flex-wrap justify-between gap-2 text-base">
                      <Link to={`/jemaat/${item.id}`} className="font-semibold underline-offset-2 hover:underline">
                        {item.fullName}
                      </Link>
                      <span className="text-muted-foreground">
                        {item.birthDate ? formatDateLong(item.birthDate) : ''} {item.phone ? `· ${item.phone}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Daftar anggota</CardTitle>
              <CardDescription>
                {members.data ? `${members.data.meta.total} anggota ditemukan.` : 'Memuat data…'}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <form
                className="flex flex-col gap-3 lg:flex-row lg:items-end"
                onSubmit={(event) => {
                  event.preventDefault();
                  setSubmittedSearch(search.trim());
                  resetPage();
                }}
              >
                <div className="flex flex-1 flex-col gap-2">
                  <Label htmlFor="member-search" className="text-base font-semibold">Cari nama, HP, atau email</Label>
                  <Input
                    id="member-search"
                    className="min-h-11 text-base"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="cth. Maria atau 0812…"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-base font-semibold">Status</Label>
                  <Select value={status} onValueChange={(v) => { setStatus(v); resetPage(); }}>
                    <SelectTrigger className="min-h-11 w-full text-base lg:w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL} className="text-base">Semua status</SelectItem>
                      {MEMBER_STATUSES.map((s) => (
                        <SelectItem key={s} value={s} className="text-base">{MEMBER_STATUS_LABELS[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-base font-semibold">Wilayah</Label>
                  <Select value={regionId} onValueChange={(v) => { setRegionId(v); resetPage(); }}>
                    <SelectTrigger className="min-h-11 w-full text-base lg:w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL} className="text-base">Semua wilayah</SelectItem>
                      {(regions.data ?? []).map((r) => (
                        <SelectItem key={r.id} value={r.id} className="text-base">{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-base font-semibold">Komisi/Tim</Label>
                  <Select value={groupId} onValueChange={(v) => { setGroupId(v); resetPage(); }}>
                    <SelectTrigger className="min-h-11 w-full text-base lg:w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL} className="text-base">Semua komisi</SelectItem>
                      {(groups.data ?? []).map((g) => (
                        <SelectItem key={g.id} value={g.id} className="text-base">{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-base font-semibold">Bulan lahir</Label>
                  <Select value={birthMonth} onValueChange={(v) => { setBirthMonth(v); resetPage(); }}>
                    <SelectTrigger className="min-h-11 w-full text-base lg:w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL} className="text-base">Semua bulan</SelectItem>
                      {MONTHS.map((name, index) => (
                        <SelectItem key={name} value={String(index + 1)} className="text-base">{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" size="lg">
                  <Search aria-hidden /> Cari
                </Button>
              </form>

              {members.isPending ? <LoadingState label="Memuat anggota…" /> : null}
              {members.isError ? (
                <div className="flex flex-col gap-3">
                  <ErrorAlert message={errorMessage(members.error)} />
                  <Button variant="outline" onClick={() => void members.refetch()}>
                    <RefreshCw aria-hidden /> Coba lagi
                  </Button>
                </div>
              ) : null}

              {members.data && members.data.items.length === 0 ? (
                <p className="py-6 text-base text-muted-foreground">
                  Belum ada anggota yang cocok. Tambah manual atau impor dari Excel.
                </p>
              ) : null}

              {members.data && members.data.items.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-base">Nama</TableHead>
                          <TableHead className="text-base">Status</TableHead>
                          <TableHead className="text-base">Wilayah</TableHead>
                          <TableHead className="text-base">Komisi/Tim</TableHead>
                          <TableHead className="text-base">HP / WhatsApp</TableHead>
                          <TableHead className="text-right text-base">Tindakan</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {members.data.items.map((member) => (
                          <TableRow key={member.id}>
                            <TableCell className="text-base font-semibold">{member.fullName}</TableCell>
                            <TableCell>
                              <Badge variant={member.status === 'aktif' ? 'default' : 'outline'} className="text-sm">
                                {MEMBER_STATUS_LABELS[member.status]}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-base">{member.regionName ?? '—'}</TableCell>
                            <TableCell className="text-base">{member.groupNames.join(', ') || '—'}</TableCell>
                            <TableCell className="text-base">{member.phone ?? '—'}</TableCell>
                            <TableCell className="text-right">
                              <Button asChild variant="outline" size="sm">
                                <Link to={`/jemaat/${member.id}`}>Lihat detail</Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-base text-muted-foreground">
                      Halaman {members.data.meta.page} dari {members.data.meta.totalPages} ·{' '}
                      {members.data.meta.total} anggota
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="lg"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        Sebelumnya
                      </Button>
                      <Button
                        variant="outline"
                        size="lg"
                        disabled={page >= members.data.meta.totalPages}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        Berikutnya
                      </Button>
                    </div>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="keluarga">
          <FamiliesSection canWrite={canWrite} />
        </TabsContent>
        <TabsContent value="wilayah">
          <RegionsSection canWrite={canWrite} />
        </TabsContent>
        <TabsContent value="komisi">
          <GroupsSection canWrite={canWrite} onManage={setManagingGroup} />
        </TabsContent>
      </Tabs>

      <MemberFormDialog open={formOpen} onOpenChange={setFormOpen} />
      <ImportMembersDialog open={importOpen} onOpenChange={setImportOpen} />
      <GroupMembersDialog group={managingGroup} canWrite={canWrite} onClose={() => setManagingGroup(null)} />
    </div>
  );
}
