import { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Toaster } from 'sonner';
import { AppLayout } from './components/layout/AppLayout';
import { BarcodePrinter } from './components/BarcodePrinter';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Loading } from './components/ui/Loading';

// Lazy load pages for better performance
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(module => ({ default: module.DashboardPage })));
const PatientsPage = lazy(() => import('./pages/PatientsPage').then(module => ({ default: module.PatientsPage })));
const PatientDetailPage = lazy(() => import('./pages/PatientDetailPage').then(module => ({ default: module.PatientDetailPage })));
const SamplesPage = lazy(() => import('./pages/SamplesPage').then(module => ({ default: module.SamplesPage })));
const NewOrderPage = lazy(() => import('./pages/NewOrderPage').then(module => ({ default: module.NewOrderPage })));
const ResultsPage = lazy(() => import('./pages/ResultsPage').then(module => ({ default: module.ResultsPage })));
const WorklistPage = lazy(() => import('./pages/WorklistPage').then(module => ({ default: module.WorklistPage })));
const TestCatalogPage = lazy(() => import('./pages/TestCatalogPage').then(module => ({ default: module.TestCatalogPage })));
const InstrumentsPage = lazy(() => import('./pages/InstrumentsPage').then(module => ({ default: module.InstrumentsPage })));
const UnmatchedDataPage = lazy(() => import('./pages/UnmatchedDataPage').then(module => ({ default: module.UnmatchedDataPage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then(module => ({ default: module.ReportsPage })));
const ReportPreviewPage = lazy(() => import('./pages/ReportPreviewPage').then(module => ({ default: module.ReportPreviewPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(module => ({ default: module.SettingsPage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then(module => ({ default: module.LoginPage })));
const SetupPage = lazy(() => import('./pages/SetupPage').then(module => ({ default: module.SetupPage })));
const UserManagementPage = lazy(() => import('./pages/UserManagementPage').then(module => ({ default: module.UserManagementPage })));
const AuditLogPage = lazy(() => import('./pages/AuditLogPage').then(module => ({ default: module.AuditLogPage })));
const FeedbackPage = lazy(() => import('./pages/FeedbackPage').then(module => ({ default: module.FeedbackPage })));

function RequireAuth() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

function AppContent() {
  const { i18n } = useTranslation();

  useEffect(() => {
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors />
      <BarcodePrinter />
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/setup" element={<SetupPage />} />

          {/* Protected Routes */}
          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/patients" element={<PatientsPage />} />
              <Route path="/patients/:id" element={<PatientDetailPage />} />
              <Route path="/samples" element={<SamplesPage />} />
              <Route path="/orders/new" element={<NewOrderPage />} />
              <Route path="/results" element={<ResultsPage />} />
              <Route path="/worklist" element={<WorklistPage />} />
              <Route path="/test-catalog" element={<TestCatalogPage />} />
              <Route path="/instruments" element={<InstrumentsPage />} />
              <Route path="/users" element={<UserManagementPage />} />
              <Route path="/audit-logs" element={<AuditLogPage />} />
              <Route path="/unmatched" element={<UnmatchedDataPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/reports/:sampleId" element={<ReportPreviewPage />} />
              <Route path="/feedback" element={<FeedbackPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
