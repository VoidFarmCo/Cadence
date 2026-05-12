import { Analytics } from "@vercel/analytics/react"
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { useEffect, lazy, Suspense, Component } from 'react';
import PageNotFound from './lib/PageNotFound';
import FullScreenSpinner from './lib/FullScreenSpinner';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import SuperAdminRoute from '@/components/SuperAdminRoute';

import RoleRouter from './pages/RoleRouter';
import Home from './pages/Home';
import Login from './pages/Login';
import AcceptInvite from './pages/AcceptInvite';
import ResetPassword from './pages/ResetPassword';
import AdminDashboard from './pages/admin/AdminDashboard';
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

// Lazy-loaded so importing src/lib/supabase.js (and the @supabase/supabase-js
// chunk) is deferred until a user actually visits /supabase-auth. Keeps the
// rest of the app independent of Supabase env vars during the migration AND
// of any browser-bundle issues in the supabase client (the eager version of
// this import landed in #26 and white-screened the whole site — see PR #28
// description and the plan file for details).
const SupabaseAuth = lazy(() => import('./pages/SupabaseAuth'));

// Tiny error boundary scoped to a single route. When the wrapped subtree
// throws — either at chunk-load time (the lazy import promise rejects) or
// during render — we surface the message inline as a red card instead of
// letting the failure cascade into a blank screen with no visible signal.
//
// Stack-trace gating: full stack only renders in dev builds or when the URL
// has ?debug=1, so production visitors don't see internal file paths.
class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[RouteErrorBoundary]', this.props.routeName || 'route', error, info);
  }
  render() {
    if (!this.state.error) return this.props.children;
    const e = this.state.error;
    const showStack =
      import.meta.env.DEV ||
      (typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('debug') === '1');
    return (
      <div className="min-h-screen bg-red-50 dark:bg-red-950 py-12 px-4">
        <div className="max-w-md mx-auto bg-white dark:bg-slate-900 border border-red-200 dark:border-red-800 rounded-xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-red-700 dark:text-red-300 mb-2">
            Couldn't load {this.props.routeName || 'this page'}
          </h2>
          <p className="text-sm text-red-700 dark:text-red-300 mb-3 font-medium">
            {e?.message || String(e)}
          </p>
          {showStack && e?.stack ? (
            <pre className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words bg-slate-100 dark:bg-slate-800 rounded p-2 max-h-96 overflow-auto">
              {e.stack}
            </pre>
          ) : (
            <p className="text-xs text-slate-500">
              Append <code className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">?debug=1</code> to the URL to see the stack trace.
            </p>
          )}
        </div>
      </div>
    );
  }
}

function useDarkMode() {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = (dark) => document.documentElement.classList.toggle('dark', dark);
    const handler = (e) => apply(e.matches);
    apply(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
}

// `/` shows the marketing landing page for anonymous visitors and
// hands off to RoleRouter (which dispatches to the right dashboard)
// for authenticated users.
const RootRoute = () => {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  if (isLoadingAuth) return <FullScreenSpinner />;
  return isAuthenticated ? <RoleRouter /> : <Home />;
};

const AuthenticatedApp = () => {
  useDarkMode();

  return (
    <Routes>
      {/* Public routes — no auth required */}
      <Route path="/" element={<RootRoute />} />
      <Route path="/login" element={<Login />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* New Supabase auth (preview) — lazy-loaded so it doesn't pull the
          Supabase client into the legacy bundle. Wrapped in an error
          boundary so chunk-load failures or render errors render an inline
          message instead of a blank screen. */}
      <Route
        path="/supabase-auth"
        element={
          <RouteErrorBoundary routeName="Supabase auth">
            <Suspense fallback={<FullScreenSpinner />}>
              <SupabaseAuth />
            </Suspense>
          </RouteErrorBoundary>
        }
      />

      {/* Protected routes — require authentication */}
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<SuperAdminRoute />}>
          <Route path="/admin" element={<AdminDashboard />} />
        </Route>
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
          <Route path="/settings/billing" element={<Billing />} />
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
        <Analytics />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
