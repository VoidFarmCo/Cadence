import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, ClipboardCheck, DollarSign, CalendarDays, Map } from 'lucide-react';
import { cn } from '@/lib/utils';

const primaryTabs = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/schedule', icon: CalendarDays, label: 'Schedule' },
  { path: '/map', icon: Map, label: 'Map' },
  { path: '/time-approval', icon: ClipboardCheck, label: 'Time' },
  { path: '/people', icon: Users, label: 'People' },
  { path: '/payroll', icon: DollarSign, label: 'Payroll' },
];

export default function EmployerMobileNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border z-50 lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around min-h-[60px] max-w-lg mx-auto px-1">
        {primaryTabs.map(({ path, icon: Icon, label }) => {
          const isActive = pathname === path || pathname.startsWith(path);
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 min-h-14 min-w-12 px-2 rounded-xl transition-all duration-200 select-none active:scale-95",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
              aria-label={label}
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