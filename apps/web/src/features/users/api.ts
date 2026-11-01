import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InviteUserInput, UpdateUserInput } from '@eklesia/shared';
import type { PublicUser } from '@eklesia/api';
import { apiClient } from '@/lib/api';
import { toApiError } from '@/lib/http';

export interface InviteResult {
  user: PublicUser;
  emailSent: boolean;
  inviteUrl?: string;
}

const USERS_KEY = ['users'] as const;

export function useUsers() {
  return useQuery({
    queryKey: USERS_KEY,
    queryFn: async (): Promise<PublicUser[]> => {
      const response = await apiClient.api.users.$get();
      if (!response.ok) {
        throw await toApiError(response);
      }
      const body = await response.json();
      return body.items;
    },
  });
}

export function useInviteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: InviteUserInput): Promise<InviteResult> => {
      const response = await apiClient.api.users.invite.$post({ json: input });
      if (!response.ok) {
        throw await toApiError(response);
      }
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_KEY }),
  });
}

export function useResendInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<InviteResult> => {
      const response = await apiClient.api.users[':id'].invite.$post({ param: { id } });
      if (!response.ok) {
        throw await toApiError(response);
      }
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_KEY }),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateUserInput }) => {
      const response = await apiClient.api.users[':id'].$patch({ param: { id }, json: input });
      if (!response.ok) {
        throw await toApiError(response);
      }
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_KEY }),
  });
}
