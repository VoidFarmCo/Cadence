import { useAuth } from '@/lib/AuthContext';

// Reads the already-fetched user from AuthContext instead of issuing a
// per-component /api/auth/me request. Fan-out from ~14 consumers was
// flooding the backend with 401s when logged out and duplicate 200s when
// logged in.
export default function useCurrentUser() {
  const { user, isLoadingAuth } = useAuth();
  const profile = user?.workerProfile || null;
  const loading = isLoadingAuth;

  const workerRole = profile?.role; // 'owner' | 'payroll_admin' | 'manager' | 'worker'
  const isEmployer = ['owner', 'payroll_admin', 'manager'].includes(workerRole);
  const isOwner = workerRole === 'owner';
  const isPayrollAdmin = workerRole === 'payroll_admin' || workerRole === 'owner';
  const isManager = workerRole === 'manager' || isPayrollAdmin;
  const isWorker = workerRole === 'worker';
  const isContractor = profile?.worker_type === 'contractor';
  const isSuperAdmin = user?.platform_role === 'superadmin' || user?.is_platform_admin === true;

  return { user, profile, loading, isEmployer, isOwner, isPayrollAdmin, isManager, isWorker, isContractor, isSuperAdmin };
}
