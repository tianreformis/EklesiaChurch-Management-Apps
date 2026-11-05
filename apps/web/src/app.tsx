import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { LoadingState } from '@/components/feedback/loading-state';
import { AppLayout } from '@/components/layout/app-layout';
import { ChurchUserOnly, SuperAdminOnly, useCurrentProfile } from '@/features/auth/guards';
import { RequireSession } from '@/features/auth/require-session';

// Code splitting per rute supaya muat awal tetap ringan di HP.
const LoginPage = lazy(() => import('@/routes/login-page'));
const ForgotPasswordPage = lazy(() => import('@/routes/forgot-password-page'));
const ResetPasswordPage = lazy(() => import('@/routes/reset-password-page'));
const AcceptInvitationPage = lazy(() => import('@/routes/accept-invitation-page'));
const DashboardPage = lazy(() => import('@/routes/dashboard-page'));
const MembersPage = lazy(() => import('@/routes/members-page'));
const MemberDetailPage = lazy(() => import('@/routes/member-detail-page'));
const SchedulePage = lazy(() => import('@/routes/schedule-page'));
const UsersPage = lazy(() => import('@/routes/users-page'));
const ChurchSettingsPage = lazy(() => import('@/routes/church-settings-page'));
const AuditPage = lazy(() => import('@/routes/audit-page'));
const PlatformPage = lazy(() => import('@/routes/platform-page'));
const ModulePlaceholderPage = lazy(() => import('@/routes/module-placeholder-page'));
const NotFoundPage = lazy(() => import('@/routes/not-found-page'));

function HomeRedirect() {
  const profile = useCurrentProfile();
  return <Navigate to={profile.kind === 'super_admin' ? '/platform' : '/dashboard'} replace />;
}

export function App() {
  return (
    <Suspense fallback={<LoadingState />}>
      <Routes>
        <Route path="/masuk" element={<LoginPage />} />
        <Route path="/lupa-password" element={<ForgotPasswordPage />} />
        <Route path="/atur-ulang-password" element={<ResetPasswordPage />} />
        <Route path="/undangan" element={<AcceptInvitationPage />} />

        <Route element={<RequireSession />}>
          <Route element={<AppLayout />}>
            <Route index element={<HomeRedirect />} />
            <Route
              path="/dashboard"
              element={
                <ChurchUserOnly>
                  <DashboardPage />
                </ChurchUserOnly>
              }
            />
            <Route
              path="/jemaat"
              element={
                <ChurchUserOnly>
                  <MembersPage />
                </ChurchUserOnly>
              }
            />
            <Route
              path="/jemaat/:id"
              element={
                <ChurchUserOnly>
                  <MemberDetailPage />
                </ChurchUserOnly>
              }
            />
            <Route
              path="/jadwal"
              element={
                <ChurchUserOnly>
                  <SchedulePage />
                </ChurchUserOnly>
              }
            />
            <Route
              path="/keuangan"
              element={
                <ChurchUserOnly>
                  <ModulePlaceholderPage />
                </ChurchUserOnly>
              }
            />
            <Route
              path="/pengguna"
              element={
                <ChurchUserOnly>
                  <UsersPage />
                </ChurchUserOnly>
              }
            />
            <Route
              path="/jejak-audit"
              element={
                <ChurchUserOnly>
                  <AuditPage />
                </ChurchUserOnly>
              }
            />
            <Route
              path="/pengaturan"
              element={
                <ChurchUserOnly>
                  <ChurchSettingsPage />
                </ChurchUserOnly>
              }
            />
            <Route
              path="/platform"
              element={
                <SuperAdminOnly>
                  <PlatformPage />
                </SuperAdminOnly>
              }
            />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
