import { useState, useEffect } from 'react';
import api from '@/api/apiClient';
import { WorkerProfiles } from '@/api/entities';

export default function useCurrentUser() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data: me } = await api.get('/api/auth/me');
        setUser(me);
        const profiles = await WorkerProfiles.list({ user_email: me.email });
        setProfile(profiles[0] || null);
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

  return { user, profile, loading, isEmployer, isOwner, isPayrollAdmin, isManager, isWorker, isContractor };
}
