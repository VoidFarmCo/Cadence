import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Clock, CalendarDays, CalendarOff, FileText, Receipt, TrendingUp, ChevronRight, AlertCircle } from 'lucide-react';
import { format, startOfWeek, endOfWeek, parseISO } from 'date-fns';
import { formatHours } from '@/lib/timeUtils';

export default function WorkerHome() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [weekHours, setWeekHours] = useState(0);
  const [weekOT, setWeekOT] = useState(0);
  const [pendingForms, setPendingForms] = useState(0);
  const [pendingLeave, setPendingLeave] = useState(null);
  const [nextShift, setNextShift] = useState(null);
  const [lastPunch, setLastPunch] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const me = await base44.auth.me();
      setUser(me);
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 0 });

      const [profiles, entries, forms, leaves, shifts, punches] = await Promise.all([
        base44.entities.WorkerProfile.filter({ user_email: me.email }),
        base44.entities.TimeEntry.filter({ worker_email: me.email }, '-date', 50),
        base44.entities.TaxForm.filter({ worker_email: me.email, status: 'pending' }),
        base44.entities.LeaveRequest.filter({ worker_email: me.email, status: 'pending' }),
        base44.entities.Shift.filter({ worker_email: me.email }, 'date', 5),
        base44.entities.Punch.filter({ worker_email: me.email }, '-created_date', 1),
      ]);

      setProfile(profiles[0] || null);

      const weekEntries = entries.filter(e => {
        if (!e.date) return false;
        const d = parseISO(e.date);
        return d >= weekStart && d <= weekEnd;
      });
      setWeekHours(weekEntries.reduce((s, e) => s + (e.total_hours || 0), 0));
      setWeekOT(weekEntries.reduce((s, e) => s + (e.overtime_hours || 0), 0));
      setPendingForms(forms.length);
      setPendingLeave(leaves[0] || null);

      const upcoming = shifts.filter(s => s.date >= format(now, 'yyyy-MM-dd') && s.status !== 'cancelled');
      setNextShift(upcoming[0] || null);
      setLastPunch(punches[0] || null);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  const isClockedIn = lastPunch?.punch_type === 'clock_in' || lastPunch?.punch_type === 'break_end';
  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="space-y-5 animate-slide-up pb-4">
      {/* Greeting */}
      <div className="pt-2">
        <p className="text-muted-foreground text-sm">{greeting()},</p>
        <h1 className="text-2xl font-bold font-display tracking-tight">{profile?.full_name || user?.full_name || 'Worker'}</h1>
        <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(), 'EEEE, MMMM d')}</p>
      </div>

      {/* Clock status card */}
      <Link to="/clock" className="block bg-card border border-border rounded-xl p-4 hover:border-primary/40 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isClockedIn ? 'bg-success/10' : 'bg-muted'}`}>
              <Clock className={`w-5 h-5 ${isClockedIn ? 'text-success' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <p className="text-sm font-semibold">{isClockedIn ? 'Currently clocked in' : 'Not clocked in'}</p>
              {lastPunch && (
                <p className="text-xs text-muted-foreground">
                  Last: {lastPunch.punch_type?.replace('_', ' ')} at {lastPunch.site_name || 'unknown site'}
                </p>
              )}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </Link>

      {/* This week summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">This Week</p>
          <p className="text-2xl font-bold font-display mt-1">{formatHours(weekHours)}</p>
          <p className="text-xs text-muted-foreground">regular hrs</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Overtime</p>
          <p className={`text-2xl font-bold font-display mt-1 ${weekOT > 0 ? 'text-warning' : ''}`}>{formatHours(weekOT)}</p>
          <p className="text-xs text-muted-foreground">OT hrs</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">PTO Balance</p>
          <p className="text-2xl font-bold font-display mt-1">{profile?.pto_balance ?? 0}</p>
          <p className="text-xs text-muted-foreground">hours</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Sick Balance</p>
          <p className="text-2xl font-bold font-display mt-1">{profile?.sick_balance ?? 0}</p>
          <p className="text-xs text-muted-foreground">hours</p>
        </div>
      </div>

      {/* Alerts */}
      {pendingForms > 0 && (
        <Link to="/tax-forms-worker" className="flex items-center gap-3 bg-warning/10 border border-warning/20 rounded-xl p-4 hover:border-warning/40 transition-colors">
          <AlertCircle className="w-5 h-5 text-warning shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">{pendingForms} form{pendingForms > 1 ? 's' : ''} need your attention</p>
            <p className="text-xs text-muted-foreground">Tap to review and complete</p>
          </div>
          <ChevronRight className="w-4 h-4 text-warning" />
        </Link>
      )}

      {nextShift && (
        <div className="bg-info/5 border border-info/20 rounded-xl p-4">
          <p className="text-xs font-semibold text-info uppercase tracking-wide mb-1">Next Shift</p>
          <p className="text-sm font-semibold text-foreground">
            {format(parseISO(nextShift.date), 'EEEE, MMM d')}
            {nextShift.start_time && ` · ${nextShift.start_time}${nextShift.end_time ? ` – ${nextShift.end_time}` : ''}`}
          </p>
          {nextShift.site_name && <p className="text-xs text-muted-foreground mt-0.5">{nextShift.site_name}</p>}
        </div>
      )}

      {/* Quick links */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quick Access</p>
        {[
          { to: '/timesheet', icon: CalendarDays, label: 'View Timesheet', sub: 'Check hours & submit' },
          { to: '/time-off', icon: CalendarOff, label: 'Request Time Off', sub: `${pendingLeave ? '1 request pending' : 'PTO, sick, unpaid'}` },
          { to: '/expenses', icon: Receipt, label: 'Expenses', sub: 'Submit receipts' },
          { to: '/deductions', icon: TrendingUp, label: '1099 Deductions', sub: 'Track tax deductions' },
          { to: '/tax-forms-worker', icon: FileText, label: 'Tax & HR Forms', sub: pendingForms > 0 ? `${pendingForms} pending` : 'Completed forms' },
        ].map(({ to, icon: Icon, label, sub }) => (
          <Link key={to} to={to} className="flex items-center gap-3 bg-card border border-border rounded-xl p-4 hover:border-primary/40 transition-colors">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground">{sub}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </div>
  );
}