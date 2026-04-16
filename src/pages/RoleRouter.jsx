import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import api from '@/api/apiClient';
import Home from './Home';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, Building2 } from 'lucide-react';

function SuperAdminSelector({ companyName, onChoice }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <img
            src="https://media.base44.com/images/public/69db595f420acc2fe622536d/9b4a5552a_cadence_logo_v3b.png"
            alt="Cadence"
            className="w-8 h-8 object-contain"
          />
          <span className="font-bold text-2xl text-primary">Cadence</span>
        </div>
        <Card className="p-8 space-y-6">
          <div className="text-center">
            <h1 className="text-xl font-bold">Welcome back</h1>
            <p className="text-sm text-muted-foreground mt-1">Choose how you want to enter</p>
          </div>
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full h-auto py-4 flex items-center gap-4 justify-start"
              onClick={() => onChoice('admin')}
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-semibold">Platform Admin</p>
                <p className="text-xs text-muted-foreground">Manage all accounts, users, and billing</p>
              </div>
            </Button>
            <Button
              variant="outline"
              className="w-full h-auto py-4 flex items-center gap-4 justify-start"
              onClick={() => onChoice('company')}
            >
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 text-green-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold">{companyName || 'Company Dashboard'}</p>
                <p className="text-xs text-muted-foreground">Enter your company workspace</p>
              </div>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function RoleRouter() {
  const [role, setRole] = useState(null);
  const [platformRole, setPlatformRole] = useState(null);
  const [companyName, setCompanyName] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [choice, setChoice] = useState(null); // 'admin' | 'company' | null

  useEffect(() => {
    async function check() {
      try {
        const { data: me } = await api.get('/api/auth/me');
        setIsAuthenticated(true);
        setPlatformRole(me.platform_role);

        const { data: profile } = await api.get('/api/worker-profiles/me');
        setRole(profile.role || 'worker');

        // Try to get company name for display
        if (profile.company_id) {
          try {
            const { data: company } = await api.get(`/api/companies/${profile.company_id}`);
            setCompanyName(company.name);
          } catch {
            // non-critical
          }
        }
      } catch {
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

  // Superadmins get a choice screen
  if (platformRole === 'superadmin' && !choice) {
    return (
      <SuperAdminSelector
        companyName={companyName}
        onChoice={setChoice}
      />
    );
  }

  if (choice === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  const isEmployer = ['owner', 'payroll_admin', 'manager'].includes(role);
  return <Navigate to={isEmployer ? '/dashboard' : '/worker-home'} replace />;
}
