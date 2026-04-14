import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export default function useCurrentUser() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const me = await base44.auth.me();
      setUser(me);
      const profiles = await base44.entities.WorkerProfile.filter({ user_email: me.email });
      setProfile(profiles[0] || null);
      setLoading(false);
    }
    load();
  }, []);

  const workerRole = profile?.role; // 'owner' | 'payroll_admin' | 'manager' | 'worker'
  const isEmployer = user?.role === 'admin';
  const isOwner = workerRole === 'owner';
  const isPayrollAdmin = workerRole === 'payroll_admin' || workerRole === 'owner';
  const isManager = workerRole === 'manager' || isPayrollAdmin;
  const isWorker = user?.role === 'user';
  const isContractor = profile?.worker_type === 'contractor';

  return { user, profile, loading, isEmployer, isOwner, isPayrollAdmin, isManager, isWorker, isContractor };
}