import { useQuery } from '@tanstack/react-query';
import type { AuditLogItem } from '@eklesia/api';
import { apiClient } from '@/lib/api';
import { toApiError } from '@/lib/http';

export interface AuditPage {
  items: AuditLogItem[];
  meta: { page: number; perPage: number; total: number; totalPages: number };
}

export function useAuditLogs(page: number) {
  return useQuery({
    queryKey: ['audit', page],
    queryFn: async (): Promise<AuditPage> => {
      const response = await apiClient.api.audit.$get({ query: { page: String(page), perPage: '20' } });
      if (!response.ok) {
        throw await toApiError(response);
      }
      return response.json();
    },
  });
}
