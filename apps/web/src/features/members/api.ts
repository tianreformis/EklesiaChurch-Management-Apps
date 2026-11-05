import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateFamilyInput,
  CreateGroupInput,
  CreateMemberInput,
  CreateRegionInput,
  Gender,
  GroupType,
  ImportAction,
  ImportPreviewRow,
  MemberFilter,
  MemberStatus,
  SetGroupMembersInput,
  UpdateFamilyInput,
  UpdateGroupInput,
  UpdateMemberInput,
  UpdateRegionInput,
} from '@eklesia/shared';
import { apiClient } from '@/lib/api';
import { toApiError } from '@/lib/http';

export interface MemberListItem {
  id: string;
  familyId: string | null;
  regionId: string | null;
  fullName: string;
  nickname: string | null;
  gender: Gender | null;
  birthDate: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: MemberStatus;
  baptismDate: string | null;
  sidiDate: string | null;
  marriageDate: string | null;
  photoUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  regionName: string | null;
  groupNames: string[];
}

export type MemberRecord = Omit<MemberListItem, 'regionName' | 'groupNames'>;

export interface MemberDetail extends MemberRecord {
  family: { id: string; name: string } | null;
  region: { id: string; name: string } | null;
  groups: { id: string; name: string; type: GroupType }[];
}

export interface FamilyItem {
  id: string;
  churchId: string;
  name: string;
  headMemberId: string | null;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RegionItem {
  id: string;
  churchId: string;
  name: string;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface GroupItem {
  id: string;
  churchId: string;
  name: string;
  type: GroupType;
  description: string | null;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface GroupMemberItem {
  id: string;
  fullName: string;
  phone: string | null;
  status: MemberStatus;
  roleInGroup: string | null;
}

export interface BirthdayItem {
  id: string;
  fullName: string;
  birthDate: string | null;
  phone: string | null;
}

export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

const MEMBERS_KEY = ['members'] as const;
const FAMILIES_KEY = ['members', 'families'] as const;
const REGIONS_KEY = ['members', 'regions'] as const;
const GROUPS_KEY = ['members', 'groups'] as const;

async function ensureOk(response: Response): Promise<void> {
  if (!response.ok) {
    throw await toApiError(response);
  }
}

export function useMembers(filter: MemberFilter) {
  return useQuery({
    queryKey: [...MEMBERS_KEY, filter],
    queryFn: async (): Promise<{ items: MemberListItem[]; meta: PaginationMeta }> => {
      const query: Record<string, string> = {
        page: String(filter.page),
        perPage: String(filter.perPage),
      };
      if (filter.search) query.search = filter.search;
      if (filter.status) query.status = filter.status;
      if (filter.regionId) query.regionId = filter.regionId;
      if (filter.groupId) query.groupId = filter.groupId;
      if (filter.birthMonth) query.birthMonth = String(filter.birthMonth);
      const response = await apiClient.api.members.$get({ query });
      await ensureOk(response);
      return (await response.json()) as { items: MemberListItem[]; meta: PaginationMeta };
    },
  });
}

export function useMember(id: string | undefined) {
  return useQuery({
    queryKey: [...MEMBERS_KEY, 'detail', id],
    enabled: Boolean(id),
    queryFn: async (): Promise<MemberDetail> => {
      const response = await apiClient.api.members[':id'].$get({ param: { id: id! } });
      await ensureOk(response);
      return (await response.json()) as MemberDetail;
    },
  });
}

export function useBirthdays(month: number) {
  return useQuery({
    queryKey: [...MEMBERS_KEY, 'birthdays', month],
    queryFn: async (): Promise<{ items: BirthdayItem[]; month: number }> => {
      const response = await apiClient.api.members.birthdays.$get({
        query: { birthMonth: String(month) },
      });
      await ensureOk(response);
      return (await response.json()) as { items: BirthdayItem[]; month: number };
    },
  });
}

export function useCreateMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateMemberInput): Promise<MemberRecord> => {
      const response = await apiClient.api.members.$post({ json: input });
      await ensureOk(response);
      return (await response.json()) as unknown as MemberRecord;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MEMBERS_KEY }),
  });
}

export function useUpdateMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateMemberInput }): Promise<MemberRecord> => {
      const response = await apiClient.api.members[':id'].$patch({ param: { id }, json: input });
      await ensureOk(response);
      return (await response.json()) as unknown as MemberRecord;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MEMBERS_KEY }),
  });
}

export function useDeleteMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const response = await apiClient.api.members[':id'].$delete({ param: { id } });
      await ensureOk(response);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MEMBERS_KEY }),
  });
}

export function useFamilies() {
  return useQuery({
    queryKey: FAMILIES_KEY,
    queryFn: async (): Promise<FamilyItem[]> => {
      const response = await apiClient.api.members.meta.families.$get();
      await ensureOk(response);
      const body = (await response.json()) as { items: FamilyItem[] };
      return body.items;
    },
  });
}

export function useRegions() {
  return useQuery({
    queryKey: REGIONS_KEY,
    queryFn: async (): Promise<RegionItem[]> => {
      const response = await apiClient.api.members.meta.regions.$get();
      await ensureOk(response);
      const body = (await response.json()) as { items: RegionItem[] };
      return body.items;
    },
  });
}

export function useGroups() {
  return useQuery({
    queryKey: GROUPS_KEY,
    queryFn: async (): Promise<GroupItem[]> => {
      const response = await apiClient.api.members.meta.groups.$get();
      await ensureOk(response);
      const body = (await response.json()) as { items: GroupItem[] };
      return body.items;
    },
  });
}

export function useGroupMembers(groupId: string | undefined) {
  return useQuery({
    queryKey: [...GROUPS_KEY, groupId, 'members'],
    enabled: Boolean(groupId),
    queryFn: async (): Promise<GroupMemberItem[]> => {
      const response = await apiClient.api.members.meta.groups[':id'].members.$get({
        param: { id: groupId! },
      });
      await ensureOk(response);
      const body = (await response.json()) as { items: GroupMemberItem[] };
      return body.items;
    },
  });
}

function useSimpleMutation<TInput, TOutput>(
  key: readonly string[],
  fn: (input: TInput) => Promise<TOutput>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: key });
      void queryClient.invalidateQueries({ queryKey: MEMBERS_KEY });
    },
  });
}

export function useCreateFamily() {
  return useSimpleMutation(FAMILIES_KEY, async (input: CreateFamilyInput) => {
    const response = await apiClient.api.members.meta.families.$post({ json: input });
    await ensureOk(response);
    return response.json();
  });
}

export function useUpdateFamily() {
  return useSimpleMutation(FAMILIES_KEY, async ({ id, input }: { id: string; input: UpdateFamilyInput }) => {
    const response = await apiClient.api.members.meta.families[':id'].$patch({ param: { id }, json: input });
    await ensureOk(response);
    return response.json();
  });
}

export function useDeleteFamily() {
  return useSimpleMutation(FAMILIES_KEY, async (id: string) => {
    const response = await apiClient.api.members.meta.families[':id'].$delete({ param: { id } });
    await ensureOk(response);
    return response.json();
  });
}

export function useCreateRegion() {
  return useSimpleMutation(REGIONS_KEY, async (input: CreateRegionInput) => {
    const response = await apiClient.api.members.meta.regions.$post({ json: input });
    await ensureOk(response);
    return response.json();
  });
}

export function useUpdateRegion() {
  return useSimpleMutation(REGIONS_KEY, async ({ id, input }: { id: string; input: UpdateRegionInput }) => {
    const response = await apiClient.api.members.meta.regions[':id'].$patch({ param: { id }, json: input });
    await ensureOk(response);
    return response.json();
  });
}

export function useDeleteRegion() {
  return useSimpleMutation(REGIONS_KEY, async (id: string) => {
    const response = await apiClient.api.members.meta.regions[':id'].$delete({ param: { id } });
    await ensureOk(response);
    return response.json();
  });
}

export function useCreateGroup() {
  return useSimpleMutation(GROUPS_KEY, async (input: CreateGroupInput) => {
    const response = await apiClient.api.members.meta.groups.$post({ json: input });
    await ensureOk(response);
    return response.json();
  });
}

export function useUpdateGroup() {
  return useSimpleMutation(GROUPS_KEY, async ({ id, input }: { id: string; input: UpdateGroupInput }) => {
    const response = await apiClient.api.members.meta.groups[':id'].$patch({ param: { id }, json: input });
    await ensureOk(response);
    return response.json();
  });
}

export function useDeleteGroup() {
  return useSimpleMutation(GROUPS_KEY, async (id: string) => {
    const response = await apiClient.api.members.meta.groups[':id'].$delete({ param: { id } });
    await ensureOk(response);
    return response.json();
  });
}

export function useSetGroupMembers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ groupId, input }: { groupId: string; input: SetGroupMembersInput }) => {
      const response = await apiClient.api.members.meta.groups[':id'].members.$put({
        param: { id: groupId },
        json: input,
      });
      await ensureOk(response);
      return response.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: GROUPS_KEY });
      void queryClient.invalidateQueries({ queryKey: MEMBERS_KEY });
    },
  });
}

/** Mengunduh berkas dari API (template/ekspor) lalu memicu unduhan browser. */
export async function downloadApiFile(path: string, filename: string): Promise<void> {
  const response = await fetch(path, { credentials: 'same-origin' });
  await ensureOk(response);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function previewMemberImport(file: File): Promise<{ rows: ImportPreviewRow[]; totalRows: number; errorRows: number }> {
  const form = new FormData();
  form.append('file', file);
  const response = await fetch('/api/members-import/preview', {
    method: 'POST',
    credentials: 'same-origin',
    body: form,
  });
  await ensureOk(response);
  return (await response.json()) as { rows: ImportPreviewRow[]; totalRows: number; errorRows: number };
}

export async function confirmMemberImport(
  rows: ImportPreviewRow[],
  choices: { rowNumber: number; action: ImportAction }[],
): Promise<ImportResult> {
  const response = await fetch('/api/members-import/confirm', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows, choices }),
  });
  await ensureOk(response);
  return (await response.json()) as ImportResult;
}
