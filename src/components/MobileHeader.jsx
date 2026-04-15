import NotificationBell from './NotificationBell';
import { Link } from 'react-router-dom';

export default function MobileHeader({ user, isAdmin }) {
  return (
    <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b border-border lg:hidden">
      <div className="flex items-center justify-between h-14 px-4">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-xs font-bold text-primary-foreground">⚡</span>
          </div>
          <span className="text-sm font-bold font-display tracking-tight">Cadence</span>
        </Link>
        <div className="flex items-center gap-3">
          <NotificationBell user={user} isAdmin={isAdmin} />
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary">
            {user?.full_name?.charAt(0) || 'U'}
          </div>
        </div>
      </div>
    </header>
  );
}