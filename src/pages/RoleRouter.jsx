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

          // Try to find an existing WorkerProfile using a temporary owner promotion
          // only if user doesn't already have a known app role
          const knownRoles = ['owner', 'admin', 'manager', 'payroll_admin', 'worker'];
          const needsPromotion = !knownRoles.includes(me.role);
          if (needsPromotion) {
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
            // Brand new user with no profile — make them owner and onboard
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
            // Existing user — use their WorkerProfile role as the source of truth
            const profileRole = profiles[0].role || 'worker';

            // If their platform role doesn't match their WorkerProfile role, sync it
            const freshMe = await base44.auth.me();
            if (freshMe.role !== profileRole) {
              await base44.auth.updateMe({ role: profileRole });
            }

            setRole(profileRole);
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