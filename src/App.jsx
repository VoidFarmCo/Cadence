import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { useEffect } from 'react';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import RoleRouter from './pages/RoleRouter';
import AppPreview from './pages/AppPreview';
import EmployerLayout from './components/EmployerLayout';
import WorkerLayout from './components/WorkerLayout';
import Dashboard from './pages/employer/Dashboard';
import People from './pages/employer/People';
import Sites from './pages/employer/Sites';
import TimeApproval from './pages/employer/TimeApproval';
import TimeOffAdmin from './pages/employer/TimeOffAdmin';
import PayrollRuns from './pages/employer/PayrollRuns';
import Reports from './pages/employer/Reports';
import Settings from './pages/employer/Settings';
import ClockPage from './pages/worker/ClockPage';
import TaxForms from './pages/employer/TaxForms';
import MapView from './pages/employer/MapView';
import SchedulePage from './pages/employer/SchedulePage';
import TaxFormPage from './pages/worker/TaxFormPage';
import WorkerHome from './pages/worker/WorkerHome';
import DeductionsPage from './pages/worker/DeductionsPage';
import TimesheetPage from './pages/worker/TimesheetPage';
import TimeOffPage from './pages/worker/TimeOffPage';
import ExpensesPage from './pages/worker/ExpensesPage';
import ProfilePage from './pages/worker/ProfilePage';
import Billing from './pages/employer/Billing';
import PayrollAnalytics from './pages/employer/PayrollAnalytics';
import Users from './pages/employer/Users';

function useDarkMode() {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = (dark) => document.documentElement.classList.toggle('dark', dark);
    apply(mq.matches);
    mq.addEventListener('change', e => apply(e.matches));
    return () => mq.removeEventListener('change', e => apply(e.matches));
  }, []);
}

const AuthenticatedApp = () => {
  useDarkMode();
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/" element={<RoleRouter />} />
      <Route path="/app-preview" element={<AppPreview />} />
      {/* Employer Routes */}
      <Route element={<EmployerLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/people" element={<People />} />
        <Route path="/sites" element={<Sites />} />
        <Route path="/time-approval" element={<TimeApproval />} />
        <Route path="/time-off-admin" element={<TimeOffAdmin />} />
        <Route path="/payroll" element={<PayrollRuns />} />
        <Route path="/payroll-analytics" element={<PayrollAnalytics />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/tax-forms" element={<TaxForms />} />
        <Route path="/map" element={<MapView />} />
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/users" element={<Users />} />
      </Route>
      {/* Worker Routes */}
      <Route element={<WorkerLayout />}>
        <Route path="/clock" element={<ClockPage />} />
        <Route path="/timesheet" element={<TimesheetPage />} />
        <Route path="/time-off" element={<TimeOffPage />} />
        <Route path="/expenses" element={<ExpensesPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/worker-home" element={<WorkerHome />} />
        <Route path="/tax-forms-worker" element={<TaxFormPage />} />
        <Route path="/deductions" element={<DeductionsPage />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App