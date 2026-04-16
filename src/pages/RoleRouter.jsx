import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import Home from './Home';

export default function RoleRouter() {
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [onboardingStatus, setOnboardingStatus] = useState('');

  useEffect(() => {
    async function check() {
      try {
        const authed = await base44.auth.isAuthenticated();
        setIsAuthenticated(authed);

        if (authed) {
          const me = await base44.auth.me();

          // Promote to owner first so RLS allows querying WorkerProfile
          const knownRoles = ['owner', 'admin', 'manager', 'payroll_admin', 'worker'];
          if (!knownRoles.includes(me.role)) {
            await base44.auth.updateMe({ role: 'owner' });
          }

          // Check if this user already has a WorkerProfile
          let profiles = [];
          try {
            profiles = await base44.entities.WorkerProfile.filter({ user_email: me.email });
          } catch (e) {
            console.error('Failed to fetch profiles:', e);
          }

          if (profiles.length === 0) {
            // First-time user — ensure owner role is set
            await base44.auth.updateMe({ role: 'owner' });

            setOnboardingStatus('Setting up your account...');

            const now = new Date();
            const trialEnd = new Date(now);
            trialEnd.setDate(trialEnd.getDate() + 30);

            await base44.entities.WorkerProfile.create({
              user_email: me.email,
              full_name: me.full_name,
              worker_type: 'employee',
              role: 'owner',
              status: 'active',
            });

            await base44.entities.Account.create({
              owner_email: me.email,
              owner_name: me.full_name,
              status: 'trial',
              trial_start: now.toISOString(),
              trial_end: trialEnd.toISOString(),
            });

            base44.analytics.track({
              eventName: 'new_company_account_created',
              properties: {
                owner_email: me.email,
                owner_name: me.full_name,
                trial_start: now.toISOString(),
                trial_end: trialEnd.toISOString(),
              }
            });

            setRole('owner');
          } else {
            // Re-fetch the user to get the latest role (not the cached pre-promotion value)
            const freshMe = await base44.auth.me();
            setRole(freshMe.role || 'worker');
          }
        }
      } catch (e) {
        console.error('RoleRouter error:', e);
      } finally {
        setLoading(false);
      }
    }
    check();
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center flex-col gap-3">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        {onboardingStatus && (
          <p className="text-sm text-muted-foreground">{onboardingStatus}</p>
        )}
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Home />;
  }

  const isEmployer = ['admin', 'owner', 'payroll_admin', 'manager'].includes(role);
  return <Navigate to={isEmployer ? '/dashboard' : '/worker-home'} replace />;
}