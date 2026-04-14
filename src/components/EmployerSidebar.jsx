import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, MapPin, ClipboardCheck, CalendarOff, DollarSign, BarChart3, Settings, LogOut, Sprout, FileText, Map, CalendarDays, CreditCard } from 'lucide-react';


import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/people', icon: Users, label: 'People' },
  { path: '/sites', icon: MapPin, label: 'Sites & Fields' },
  { path: '/map', icon: Map, label: 'Live Map' },
  { path: '/schedule', icon: CalendarDays, label: 'Schedule' },
  { path: '/time-approval', icon: ClipboardCheck, label: 'Time Approval' },
  { path: '/time-off-admin', icon: CalendarOff, label: 'Time Off' },
  { path: '/payroll', icon: DollarSign, label: 'Payroll Runs' },
  { path: '/reports', icon: BarChart3, label: 'Reports' },
  { path: '/tax-forms', icon: FileText, label: 'Tax & HR Forms' },
  { path: '/settings', icon: Settings, label: 'Settings' },
  { path: '/billing', icon: CreditCard, label: 'Billing' },
];

export default function EmployerSidebar({ user }) {
  const { pathname } = useLocation();

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-sidebar border-r border-sidebar-border h-screen sticky top-0">
      <div className="p-6 border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <Sprout className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-sidebar-foreground font-display tracking-tight">FieldClock</h1>
            <p className="text-[11px] text-sidebar-foreground/50">Workforce Management</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = path === '/' ? pathname === '/' : pathname.startsWith(path);
          return (
            <Link
              key={path}
              to={path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <Icon className="w-[18px] h-[18px]" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-sidebar-primary/20 flex items-center justify-center text-xs font-bold text-sidebar-primary">
            {user?.full_name?.charAt(0) || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-sidebar-foreground truncate">{user?.full_name || 'User'}</p>
            <p className="text-[10px] text-sidebar-foreground/50 capitalize">{user?.role || 'owner'}</p>
          </div>
          <button
            onClick={() => base44.auth.logout()}
            className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}