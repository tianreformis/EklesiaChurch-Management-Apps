import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AssignmentStatus,
  CreateAssignmentInput,
  CreateServiceInput,
  CreateServiceRoleInput,
  CreateSwapRequestInput,
  ReminderChannel,
  ServiceStatus,
  SwapStatus,
  UpdateServiceInput,
  UpdateServiceRoleInput,
} from '@eklesia/shared';
import { apiClient } from '@/lib/api';
import { toApiError } from '@/lib/http';
import { downloadApiFile } from '@/features/members/api';

export { downloadApiFile };

export interface ServiceItem {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string | null;
  location: string | null;
  theme: string | null;
  preacher: string | null;
  recurrenceId: string | null;
  status: ServiceStatus;
  notes: string | null;
  assignmentTotal: number;
  assignmentConfirmed: number;
}

export interface AssignmentItem {
  id: string;
  serviceRoleId: string;
  roleName: string;
  memberId: string;
  memberName: string;
  memberPhone: string | null;
  status: AssignmentStatus;
  notes: string | null;
}

export interface ServiceDetail extends Omit<ServiceItem, 'assignmentTotal' | 'assignmentConfirmed'> {
  assignments: AssignmentItem[];
}

export interface ServiceRoleItem {
  id: string;
  name: string;
  groupId: string | null;
  sortOrder: number;
}

export interface MyAssignmentItem {
  id: string;
  status: AssignmentStatus;
  notes: string | null;
  serviceId: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string | null;
  location: string | null;
  roleName: string;
}

export interface SwapItem {
  id: string;
  assignmentId: string;
  requestedBy: string;
  proposedMemberId: string;
  status: SwapStatus;
  reason: string | null;
  requesterName: string;
  proposedName: string;
  serviceTitle: string;
  serviceDate: string | null;
  roleName: string;
}

export interface ReminderItemResult {
  assignmentId: string;
  memberName: string;
  roleName: string;
  phone: string | null;
  email: string | null;
  waLink: string | null;
  emailSent: boolean;
  message: string;
}

const SCHEDULE_KEY = ['schedule'] as const;
const ROLES_KEY = ['schedule', 'roles'] as const;
const MINE_KEY = ['schedule', 'mine'] as const;
const SWAPS_KEY = ['schedule', 'swaps'] as const;

async function ensureOk(response: Response): Promise<void> {
  if (!response.ok) {
    throw await toApiError(response);
  }
}

export function useServices(month: string) {
  return useQuery({
    queryKey: [...SCHEDULE_KEY, 'services', month],
    queryFn: async (): Promise<ServiceItem[]> => {
      const response = await apiClient.api.schedule.services.$get({ query: { month } });
      await ensureOk(response);
      const body = (await response.json()) as { items: ServiceItem[] };
      return body.items;
    },
  });
}

export function useServiceDetail(id: string | undefined) {
  return useQuery({
    queryKey: [...SCHEDULE_KEY, 'service', id],
    enabled: Boolean(id),
    queryFn: async (): Promise<ServiceDetail> => {
      const response = await apiClient.api.schedule.services[':id'].$get({ param: { id: id! } });
      await ensureOk(response);
      return (await response.json()) as ServiceDetail;
    },
  });
}

export function useServiceRoles() {
  return useQuery({
    queryKey: ROLES_KEY,
    queryFn: async (): Promise<ServiceRoleItem[]> => {
      const response = await apiClient.api.schedule.roles.$get();
      await ensureOk(response);
      const body = (await response.json()) as { items: ServiceRoleItem[] };
      return body.items;
    },
  });
}

export function useMyAssignments() {
  return useQuery({
    queryKey: MINE_KEY,
    queryFn: async (): Promise<{ memberId: string | null; items: MyAssignmentItem[] }> => {
      const response = await apiClient.api.schedule.mine.$get();
      await ensureOk(response);
      return (await response.json()) as { memberId: string | null; items: MyAssignmentItem[] };
    },
  });
}

export function useSwaps() {
  return useQuery({
    queryKey: SWAPS_KEY,
    queryFn: async (): Promise<SwapItem[]> => {
      const response = await apiClient.api.schedule.swaps.$get();
      await ensureOk(response);
      const body = (await response.json()) as { items: SwapItem[] };
      return body.items;
    },
  });
}

export function useTemplates() {
  return useQuery({
    queryKey: [...SCHEDULE_KEY, 'templates'],
    queryFn: async (): Promise<{ channel: ReminderChannel; body: string }[]> => {
      const response = await apiClient.api.schedule.templates.$get();
      await ensureOk(response);
      const body = (await response.json()) as { items: { channel: ReminderChannel; body: string }[] };
      return body.items;
    },
  });
}

function useInvalidating<TInput, TOutput>(fn: (input: TInput) => Promise<TOutput>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SCHEDULE_KEY });
      void queryClient.invalidateQueries({ queryKey: MINE_KEY });
      void queryClient.invalidateQueries({ queryKey: SWAPS_KEY });
    },
  });
}

export function useCreateService() {
  return useInvalidating(async (input: CreateServiceInput) => {
    const response = await apiClient.api.schedule.services.$post({ json: input });
    await ensureOk(response);
    return response.json();
  });
}

export function useUpdateService() {
  return useInvalidating(async ({ id, input }: { id: string; input: UpdateServiceInput }) => {
    const response = await apiClient.api.schedule.services[':id'].$patch({ param: { id }, json: input });
    await ensureOk(response);
    return response.json();
  });
}

export function useDeleteService() {
  return useInvalidating(async (id: string) => {
    const response = await apiClient.api.schedule.services[':id'].$delete({ param: { id } });
    await ensureOk(response);
    return response.json();
  });
}

export function useCreateRole() {
  return useInvalidating(async (input: CreateServiceRoleInput) => {
    const response = await apiClient.api.schedule.roles.$post({ json: input });
    await ensureOk(response);
    return response.json();
  });
}

export function useUpdateRole() {
  return useInvalidating(async ({ id, input }: { id: string; input: UpdateServiceRoleInput }) => {
    const response = await apiClient.api.schedule.roles[':id'].$patch({ param: { id }, json: input });
    await ensureOk(response);
    return response.json();
  });
}

export function useDeleteRole() {
  return useInvalidating(async (id: string) => {
    const response = await apiClient.api.schedule.roles[':id'].$delete({ param: { id } });
    await ensureOk(response);
    return response.json();
  });
}

export function useCreateAssignment() {
  return useInvalidating(async (input: CreateAssignmentInput) => {
    const response = await apiClient.api.schedule.assignments.$post({ json: input });
    await ensureOk(response);
    return (await response.json()) as { assignment: unknown; warnings: string[] };
  });
}

export function useDeleteAssignment() {
  return useInvalidating(async (assignmentId: string) => {
    const response = await apiClient.api.schedule.assignments[':assignmentId'].$delete({
      param: { assignmentId },
    });
    await ensureOk(response);
    return response.json();
  });
}

export function useRespondAssignment() {
  return useInvalidating(
    async ({ assignmentId, status }: { assignmentId: string; status: 'dikonfirmasi' | 'ditolak' }) => {
      const response = await apiClient.api.schedule.assignments[':assignmentId'].respond.$patch({
        param: { assignmentId },
        json: { status },
      });
      await ensureOk(response);
      return response.json();
    },
  );
}

export function useCreateSwap() {
  return useInvalidating(async (input: CreateSwapRequestInput) => {
    const response = await apiClient.api.schedule.swaps.$post({ json: input });
    await ensureOk(response);
    return response.json();
  });
}

export function useRespondSwap() {
  return useInvalidating(async ({ id, accept }: { id: string; accept: boolean }) => {
    const response = await apiClient.api.schedule.swaps[':id'].respond.$post({
      param: { id },
      json: { accept },
    });
    await ensureOk(response);
    return response.json();
  });
}

export function useApproveSwap() {
  return useInvalidating(async ({ id, accept }: { id: string; accept: boolean }) => {
    const response = await apiClient.api.schedule.swaps[':id'].approve.$post({
      param: { id },
      json: { accept },
    });
    await ensureOk(response);
    return response.json();
  });
}

export function useCancelSwap() {
  return useInvalidating(async (id: string) => {
    const response = await apiClient.api.schedule.swaps[':id'].cancel.$post({ param: { id } });
    await ensureOk(response);
    return response.json();
  });
}

export function useUpdateTemplate() {
  return useInvalidating(async ({ channel, body }: { channel: ReminderChannel; body: string }) => {
    const response = await apiClient.api.schedule.templates[':channel'].$put({
      param: { channel },
      json: { body },
    });
    await ensureOk(response);
    return response.json();
  });
}

export async function remindService(
  serviceId: string,
  sendEmail: boolean,
): Promise<{ serviceId: string; items: ReminderItemResult[] }> {
  const response = await apiClient.api.schedule.services[':id'].remind.$post({
    param: { id: serviceId },
    json: { sendEmail },
  });
  await ensureOk(response);
  return (await response.json()) as { serviceId: string; items: ReminderItemResult[] };
}
