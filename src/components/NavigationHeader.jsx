import { useLocation, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import NotificationBell from './NotificationBell';
import { cn } from '@/lib/utils';

const ROOT_ROUTES = ['/worker-home', '/clock', '/timesheet', '/time-off', '/tax-forms-worker', '/profile', '/expenses', '/deductions'];

export default function NavigationHeader({ user, isAdmin }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isRoot = ROOT_ROUTES.includes(pathname);

  return (
    <header
      className="sticky top-0 z-50 bg-card/90 backdrop-blur-md border-b border-border"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="flex items-center justify-between h-14 px-4 max-w-lg mx-auto">
        {isRoot ? (
          <Link to="/worker-home" className="flex items-center gap-2 select-none">
            <img src="https://media.base44.com/images/public/69db595f420acc2fe622536d/9b4a5552a_cadence_logo_v3b.png" alt="Cadence" className="w-7 h-7 object-contain" />
            <span className="font-bold text-sm font-display text-primary">Cadence</span>
          </Link>
        ) : (
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm font-medium text-primary select-none active:opacity-60 transition-opacity"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        )}
        <div className="flex items-center gap-3">
          <NotificationBell user={user} isAdmin={isAdmin} />
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary select-none">
            {user?.full_name?.charAt(0) || 'U'}
          </div>
        </div>
      </div>
    </header>
  );
}