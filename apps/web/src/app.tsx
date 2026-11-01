import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { LoadingState } from '@/components/feedback/loading-state';
import { AppLayout } from '@/components/layout/app-layout';

// Code splitting per rute supaya muat awal tetap ringan di HP.
const DashboardPage = lazy(() => import('@/routes/dashboard-page'));
const ModulePlaceholderPage = lazy(() => import('@/routes/module-placeholder-page'));
const NotFoundPage = lazy(() => import('@/routes/not-found-page'));

export function App() {
  return (
    <Suspense fallback={<LoadingState />}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/jemaat" element={<ModulePlaceholderPage />} />
          <Route path="/jadwal" element={<ModulePlaceholderPage />} />
          <Route path="/keuangan" element={<ModulePlaceholderPage />} />
          <Route path="/pengaturan" element={<ModulePlaceholderPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
