import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateChurchInput, UpdateChurchStatusInput } from '@eklesia/shared';
import type { PlatformChurch, PlatformSummary } from '@eklesia/api';
import { apiClient } from '@/lib/api';
import { toApiError } from '@/lib/http';

const PLATFORM_KEY = ['platform'] as const;

export function usePlatformSummary() {
  return useQuery({
    queryKey: [...PLATFORM_KEY, 'summary'],
    queryFn: async (): Promise<PlatformSummary> => {
      const response = await apiClient.api.platform.summary.$get();
      if (!response.ok) {
        throw await toApiError(response);
      }
      return response.json();
    },
  });
}

export function usePlatformChurches() {
  return useQuery({
    queryKey: [...PLATFORM_KEY, 'churches'],
    queryFn: async (): Promise<PlatformChurch[]> => {
      const response = await apiClient.api.platform.churches.$get();
      if (!response.ok) {
        throw await toApiError(response);
      }
      const body = await response.json();
      return body.items;
    },
  });
}

export interface CreateChurchResult {
  church: PlatformChurch;
  emailSent: boolean;
  inviteUrl?: string;
}

export function useCreateChurch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateChurchInput): Promise<CreateChurchResult> => {
      const response = await apiClient.api.platform.churches.$post({ json: input });
      if (!response.ok) {
        throw await toApiError(response);
      }
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PLATFORM_KEY }),
  });
}

export function useUpdateChurchStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateChurchStatusInput }) => {
      const response = await apiClient.api.platform.churches[':id'].$patch({
        param: { id },
        json: input,
      });
      if (!response.ok) {
        throw await toApiError(response);
      }
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PLATFORM_KEY }),
  });
}
