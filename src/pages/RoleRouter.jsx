import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import Home from './Home';

export default function RoleRouter() {
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    async function check() {
      const authed = await base44.auth.isAuthenticated();
      setIsAuthenticated(authed);
      
      if (authed) {
        const me = await base44.auth.me();
        setRole(me.role || 'worker');
      }
      setLoading(false);
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

  const isEmployer = role === 'admin';
  return <Navigate to={isEmployer ? '/dashboard' : '/worker-home'} replace />;
}