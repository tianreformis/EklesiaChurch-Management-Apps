import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UpdateChurchInput } from '@eklesia/shared';
import type { ChurchProfile } from '@eklesia/api';
import { apiClient } from '@/lib/api';
import { toApiError } from '@/lib/http';

const CHURCH_KEY = ['church'] as const;

export function useChurch() {
  return useQuery({
    queryKey: CHURCH_KEY,
    queryFn: async (): Promise<ChurchProfile> => {
      const response = await apiClient.api.church.$get();
      if (!response.ok) {
        throw await toApiError(response);
      }
      const body = await response.json();
      return body.church;
    },
  });
}

export function useUpdateChurch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateChurchInput) => {
      const response = await apiClient.api.church.$patch({ json: input });
      if (!response.ok) {
        throw await toApiError(response);
      }
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CHURCH_KEY }),
  });
}
