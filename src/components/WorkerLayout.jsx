import { Outlet, useLocation } from 'react-router-dom';
import WorkerMobileNav from './WorkerMobileNav';
import NavigationHeader from './NavigationHeader';
import useCurrentUser from '@/lib/useCurrentUser';
import { AnimatePresence, motion } from 'framer-motion';

export default function WorkerLayout() {
  const { user, profile, loading, isContractor } = useCurrentUser();
  const location = useLocation();

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-background" style={{ minHeight: '100dvh' }}>
      <NavigationHeader user={user} isAdmin={false} />
      <main className="flex-1 overflow-hidden px-4 pt-4 max-w-lg mx-auto w-full" style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ x: 18, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -18, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeInOut' }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
      <WorkerMobileNav isContractor={isContractor} />
    </div>
  );
}