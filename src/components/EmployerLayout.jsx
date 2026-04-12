import { Outlet } from 'react-router-dom';
import EmployerSidebar from './EmployerSidebar';
import MobileHeader from './MobileHeader';
import useCurrentUser from '@/lib/useCurrentUser';

export default function EmployerLayout() {
  const { user, loading } = useCurrentUser();

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <EmployerSidebar user={user} />
      <div className="flex-1 flex flex-col min-h-screen">
        <MobileHeader user={user} />
        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}