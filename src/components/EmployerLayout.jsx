import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import EmployerSidebar from './EmployerSidebar';
import MobileHeader from './MobileHeader';
import EmployerMobileNav from './EmployerMobileNav';
import TrialBanner from './TrialBanner';
import Paywall from './Paywall';
import useCurrentUser from '@/lib/useCurrentUser';
import { Accounts } from '@/api/entities';

export default function EmployerLayout() {
  const { user, loading } = useCurrentUser();
  const [account, setAccount] = useState(null);
  const [accountLoading, setAccountLoading] = useState(true);

  useEffect(() => {
    if (!user?.email) return;
    Accounts.list({ owner_email: user.email })
      .then((accounts) => setAccount(accounts[0] || null))
      .catch(() => setAccount(null))
      .finally(() => setAccountLoading(false));
  }, [user?.email]);

  if (loading || accountLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Show paywall if account is locked
  if (account?.status === 'locked') {
    return <Paywall lockReason={account.lock_reason} />;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <EmployerSidebar user={user} />
      <div className="flex-1 flex flex-col min-h-screen">
        <TrialBanner account={account} />
        <MobileHeader user={user} isAdmin={true} />
        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto pb-20 lg:pb-8">
          <Outlet />
        </main>
      </div>
      <EmployerMobileNav />
    </div>
  );
}
