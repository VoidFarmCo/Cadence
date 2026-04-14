import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Users, Clock, CalendarOff, DollarSign, AlertTriangle, CheckCircle2, Timer } from 'lucide-react';
import StatsCard from '@/components/dashboard/StatsCard';
import { formatHours, formatDate } from '@/lib/timeUtils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const [workers, setWorkers] = useState([]);
  const [punches, setPunches] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [payPeriods, setPayPeriods] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [w, p, lr, pp] = await Promise.all([
        base44.entities.WorkerProfile.filter({ status: 'active' }),
        base44.entities.Punch.list('-created_date', 50),
        base44.entities.LeaveRequest.filter({ status: 'pending' }),
        base44.entities.PayPeriod.list('-start_date', 3),
      ]);
      setWorkers(w);
      setPunches(p);
      setLeaveRequests(lr);
      setPayPeriods(pp);
      setLoading(false);
    }
    load();
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];
  const todayPunches = punches.filter(p => p.timestamp?.startsWith(todayStr));
  // Sort ascending by timestamp to correctly track latest state
  const sortedTodayPunches = [...todayPunches].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const clockedInWorkers = new Set();
  sortedTodayPunches.forEach(p => {
    if (p.punch_type === 'clock_in' || p.punch_type === 'break_end') clockedInWorkers.add(p.worker_email);
    if (p.punch_type === 'clock_out' || p.punch_type === 'break_start') clockedInWorkers.delete(p.worker_email);
  });

  const exceptions = todayPunches.filter(p => p.out_of_geofence || p.offline_captured);
  const currentPeriod = payPeriods[0];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-slide-up">
      <div>
        <h1 className="text-2xl font-bold font-display tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Overview of today's workforce activity</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          icon={Users}
          label="Active Workers"
          value={workers.length}
          subtitle={`${clockedInWorkers.size} clocked in now`}
        />
        <StatsCard
          icon={Clock}
          label="Today's Punches"
          value={todayPunches.length}
          subtitle={`${exceptions.length} exception${exceptions.length !== 1 ? 's' : ''}`}
        />
        <StatsCard
          icon={CalendarOff}
          label="Pending Leave"
          value={leaveRequests.length}
          subtitle="Awaiting approval"
        />
        <StatsCard
          icon={DollarSign}
          label="Current Period"
          value={currentPeriod?.status === 'locked' ? 'Locked' : 'Open'}
          subtitle={currentPeriod ? `${formatDate(currentPeriod.start_date)} – ${formatDate(currentPeriod.end_date)}` : 'No period set'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-card rounded-xl border border-border">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent Punches</h2>
            <Link to="/time-approval">
              <Button variant="ghost" size="sm" className="text-xs">View All</Button>
            </Link>
          </div>
          <div className="divide-y divide-border">
            {todayPunches.slice(0, 6).map((punch) => (
              <div key={punch.id} className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                    {punch.worker_name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{punch.worker_name || punch.worker_email}</p>
                    <p className="text-xs text-muted-foreground capitalize">{punch.punch_type?.replace('_', ' ')} · {punch.site_name || 'No site'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {punch.out_of_geofence && (
                    <Badge variant="outline" className="text-[10px] border-warning text-warning">OOG</Badge>
                  )}
                  {punch.offline_captured && (
                    <Badge variant="outline" className="text-[10px] border-info text-info">Offline</Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {punch.timestamp ? new Date(punch.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
              </div>
            ))}
            {todayPunches.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                No punches today yet
              </div>
            )}
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="bg-card rounded-xl border border-border">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold">Pending Leave Requests</h2>
            <Link to="/time-off-admin">
              <Button variant="ghost" size="sm" className="text-xs">View All</Button>
            </Link>
          </div>
          <div className="divide-y divide-border">
            {leaveRequests.slice(0, 5).map((req) => (
              <div key={req.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{req.worker_name || req.worker_email}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {req.leave_type} · {formatDate(req.start_date)} – {formatDate(req.end_date)}
                  </p>
                </div>
                <Badge variant="secondary" className="text-xs capitalize">{req.status}</Badge>
              </div>
            ))}
            {leaveRequests.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                No pending requests
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}