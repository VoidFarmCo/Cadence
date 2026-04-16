import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import api from '@/api/apiClient';
import { WorkerProfiles, Accounts } from '@/api/entities';
import Home from './Home';

export default function RoleRouter() {
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [onboardingStatus, setOnboardingStatus] = useState('');

  useEffect(() => {
    async function check() {
      try {
        const { data: me } = await api.get('/api/auth/me');
        setIsAuthenticated(true);

        if (me) {

          // Check if this user already has a WorkerProfile
          let profiles = [];
          try {
            profiles = await WorkerProfiles.list({ user_email: me.email });
          } catch (e) {
            console.error('Failed to fetch profiles:', e);
          }

          if (profiles.length === 0) {
            // Brand new user with no profile — onboard as owner
            setOnboardingStatus('Setting up your account...');

            const now = new Date();
            const trialEnd = new Date(now);
            trialEnd.setDate(trialEnd.getDate() + 30);

            await WorkerProfiles.create({
              user_email: me.email,
              full_name: me.full_name,
              worker_type: 'employee',
              role: 'owner',
              status: 'active',
            });

            await Accounts.create({
              owner_email: me.email,
              owner_name: me.full_name,
              status: 'trial',
              trial_start: now.toISOString(),
              trial_end: trialEnd.toISOString(),
            });

            setRole('owner');
          } else {
            // Existing user — use their WorkerProfile role as the source of truth
            const profile = profiles[0];
            const profileRole = profile.role || 'worker';

            // Activate pending profiles on first login (invited users)
            if (profile.status === 'pending') {
              try {
                await WorkerProfiles.update(profile.id, { status: 'active' });
              } catch (e) {
                console.error('Failed to activate pending profile:', e);
              }
            }

            setRole(profileRole);
          }
        }
      } catch (e) {
        // Not authenticated or error — show home/login
        setIsAuthenticated(false);
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

  const isEmployer = ['owner', 'payroll_admin', 'manager'].includes(role);
  return <Navigate to={isEmployer ? '/dashboard' : '/worker-home'} replace />;
}
