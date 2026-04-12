import { Link, useLocation } from 'react-router-dom';
import { Clock, CalendarDays, CalendarOff, Receipt, UserCircle, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function WorkerMobileNav({ isContractor }) {
  const { pathname } = useLocation();

  const tabs = [
    { path: '/clock', icon: Clock, label: 'Clock' },
    { path: '/timesheet', icon: CalendarDays, label: 'Timesheet' },
    { path: '/time-off', icon: CalendarOff, label: 'Time Off' },
    ...(isContractor ? [{ path: '/expenses', icon: Receipt, label: 'Expenses' }] : []),
    { path: '/tax-forms-worker', icon: FileText, label: 'Forms' },
    { path: '/profile', icon: UserCircle, label: 'Profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 safe-area-pb">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {tabs.map(({ path, icon: Icon, label }) => {
          const isActive = pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className={cn(
                "flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all duration-200",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              <Icon className={cn("w-5 h-5", isActive && "stroke-[2.5]")} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}