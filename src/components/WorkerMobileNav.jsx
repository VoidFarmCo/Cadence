import { useLocation, useNavigate } from 'react-router-dom';
import { Clock, CalendarDays, CalendarOff, Receipt, UserCircle, FileText, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRef } from 'react';

export default function WorkerMobileNav({ isContractor }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  // Remember last visited path per tab root
  const tabHistory = useRef({});

  const tabs = [
    { path: '/worker-home', icon: Home, label: 'Home' },
    { path: '/clock', icon: Clock, label: 'Clock' },
    { path: '/timesheet', icon: CalendarDays, label: 'Timesheet' },
    { path: '/time-off', icon: CalendarOff, label: 'Time Off' },
    ...(isContractor ? [{ path: '/expenses', icon: Receipt, label: 'Expenses' }, { path: '/deductions', icon: FileText, label: 'Deductions' }] : []),
    { path: '/tax-forms-worker', icon: FileText, label: 'Forms' },
    { path: '/profile', icon: UserCircle, label: 'Profile' },
  ];

  // Track current path into tab history
  const currentTab = tabs.find(t => pathname.startsWith(t.path));
  if (currentTab) tabHistory.current[currentTab.path] = pathname;

  function handleTabPress(tabPath) {
    const target = tabHistory.current[tabPath] || tabPath;
    navigate(target);
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {tabs.map(({ path, icon: Icon, label }) => {
          const isActive = pathname.startsWith(path);
          return (
            <button
              key={path}
              onClick={() => handleTabPress(path)}
              className={cn(
                "flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all duration-200 select-none active:scale-95",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className={cn("w-5 h-5", isActive && "stroke-[2.5]")} />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}