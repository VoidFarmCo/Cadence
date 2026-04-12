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

  const isEmployer = user?.role === 'owner' || user?.role === 'payroll_admin' || user?.role === 'manager';
  const isOwner = user?.role === 'owner';
  const isPayrollAdmin = user?.role === 'payroll_admin' || user?.role === 'owner';
  const isManager = user?.role === 'manager' || isPayrollAdmin;
  const isWorker = user?.role === 'worker';
  const isContractor = profile?.worker_type === 'contractor';

  return { user, profile, loading, isEmployer, isOwner, isPayrollAdmin, isManager, isWorker, isContractor };
}