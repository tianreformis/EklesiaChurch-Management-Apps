import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export interface HealthStatus {
  status: 'ok' | 'degraded';
  app: string;
  database: 'ok' | 'unavailable';
  uptimeSeconds: number;
  checkedAt: string;
  latencyMs: number;
  httpStatus: number;
}

async function fetchHealth(): Promise<HealthStatus> {
  const response = await apiClient.api.health.$get();
  const body = await response.json();
  return { ...body, httpStatus: response.status };
}

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 30_000,
  });
}
