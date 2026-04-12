import { Outlet } from 'react-router-dom';
import WorkerMobileNav from './WorkerMobileNav';
import MobileHeader from './MobileHeader';
import useCurrentUser from '@/lib/useCurrentUser';

export default function WorkerLayout() {
  const { user, profile, loading, isContractor } = useCurrentUser();

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <MobileHeader user={user} />
      <main className="flex-1 pb-20 px-4 pt-4 max-w-lg mx-auto w-full">
        <Outlet />
      </main>
      <WorkerMobileNav isContractor={isContractor} />
    </div>
  );
}