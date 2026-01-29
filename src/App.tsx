import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Toaster } from 'sonner';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { PatientsPage } from './pages/PatientsPage';
import { PatientDetailPage } from './pages/PatientDetailPage';
import { SamplesPage } from './pages/SamplesPage';
import { NewOrderPage } from './pages/NewOrderPage';
import { ResultsPage } from './pages/ResultsPage';
import { WorklistPage } from './pages/WorklistPage';
import { TestCatalogPage } from './pages/TestCatalogPage';
import { InstrumentsPage } from './pages/InstrumentsPage';
import { UnmatchedDataPage } from './pages/UnmatchedDataPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';

function App() {
  const { i18n } = useTranslation();

  useEffect(() => {
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  // TODO: Add auth check
  const isAuthenticated = true;

  if (!isAuthenticated) {
    return (
      <>
        <Toaster position="top-right" richColors />
        <LoginPage />
      </>
    );
  }

  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
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
          <Route path="/unmatched" element={<UnmatchedDataPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}


export default App;
