import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import type { Profile } from '@eklesia/api';
import { useSession } from './api';
import { LoadingState } from '@/components/feedback/loading-state';

/** Profil pasti ada karena komponen ini dipakai di dalam `RequireSession`. */
export function useCurrentProfile(): Profile {
  const { data } = useSession();
  if (!data) {
    throw new Error('Profil belum tersedia.');
  }
  return data;
}

/** Halaman platform hanya untuk super_admin. */
export function SuperAdminOnly({ children }: { children: ReactNode }) {
  const profile = useCurrentProfile();
  if (profile.kind !== 'super_admin') {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

/** Halaman gereja tidak boleh dibuka akun platform. */
export function ChurchUserOnly({ children }: { children: ReactNode }) {
  const profile = useCurrentProfile();
  if (profile.kind !== 'user') {
    return <Navigate to="/platform" replace />;
  }
  return children;
}

export function SessionLoading() {
  return <LoadingState label="Memuat data akun…" />;
}
