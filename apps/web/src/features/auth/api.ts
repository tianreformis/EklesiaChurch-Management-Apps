import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Profile } from '@eklesia/api';
import { apiClient } from '@/lib/api';
import { toApiError } from '@/lib/http';

export const SESSION_KEY = ['session'] as const;

/** `null` berarti belum masuk; 401 bukan kesalahan yang perlu ditampilkan. */
export async function fetchSession(): Promise<Profile | null> {
  const response = await apiClient.api.auth.me.$get();
  if (response.status === 401) {
    return null;
  }
  if (!response.ok) {
    throw await toApiError(response);
  }
  const body = await response.json();
  return body.profile;
}

export function useSession() {
  return useQuery({
    queryKey: SESSION_KEY,
    queryFn: fetchSession,
    staleTime: 60_000,
    retry: false,
  });
}

export interface LoginValues {
  email: string;
  password: string;
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: LoginValues) => {
      const response = await apiClient.api.auth.login.$post({ json: values });
      if (!response.ok) {
        throw await toApiError(response);
      }
      const body = await response.json();
      return body.profile;
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(SESSION_KEY, profile);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.api.auth.logout.$post();
      if (!response.ok) {
        throw await toApiError(response);
      }
    },
    onSettled: () => {
      queryClient.setQueryData(SESSION_KEY, null);
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== SESSION_KEY });
    },
  });
}
