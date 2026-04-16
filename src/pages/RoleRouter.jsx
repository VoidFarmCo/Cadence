import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import api from '@/api/apiClient';
import Home from './Home';

export default function RoleRouter() {
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    async function check() {
      try {
        // Verify auth — this 401s if not logged in
        await api.get('/api/auth/me');
        setIsAuthenticated(true);

        // Get this user's own profile (works for any role)
        const { data: profile } = await api.get('/api/worker-profiles/me');
        setRole(profile.role || 'worker');
      } catch (e) {
        // 401 = not logged in, 404 = no profile yet (shouldn't happen post-register)
        setIsAuthenticated(false);
        setRole(null);
      } finally {
        setLoading(false);
      }
    }
    check();
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Home />;
  }

  const isEmployer = ['owner', 'payroll_admin', 'manager'].includes(role);
  return <Navigate to={isEmployer ? '/dashboard' : '/worker-home'} replace />;
}
