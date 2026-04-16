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
          setOnboardingStatus('Setting up your account...');

          // Use backend function to handle onboarding (bypasses RLS)
          const response = await base44.functions.invoke('onboardNewOwner', {});
          const result = response.data;

          if (result.isNew) {
            base44.analytics.track({
              eventName: 'new_company_account_created',
              properties: {
                role: result.role,
                trialEnd: result.trialEnd,
              }
            });
          }

          setRole(result.role);
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