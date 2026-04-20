import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

export default function SuperAdminRoute() {
  const { user, isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || (user.platform_role !== 'superadmin' && !user.is_platform_admin)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
