import { useState, useEffect } from 'react';
import api from '@/api/apiClient';

export default function useCurrentUser() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data: me } = await api.get('/api/auth/me');
        setUser(me);
        // /api/auth/me embeds the caller's worker profile; avoids a
        // second request that would 403 for non-manager roles.
        setProfile(me?.workerProfile || null);
      } catch {
        // not authenticated
      }
      setLoading(false);
    }
    load();
  }, []);

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
