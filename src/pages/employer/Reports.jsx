import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import StatsCard from '@/components/dashboard/StatsCard';
import { Clock, DollarSign, Users, CalendarOff } from 'lucide-react';
import { formatHours } from '@/lib/timeUtils';

const COLORS = ['hsl(152,45%,28%)', 'hsl(36,80%,52%)', 'hsl(200,60%,45%)', 'hsl(280,50%,55%)'];

export default function Reports() {
  const [entries, setEntries] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [e, w] = await Promise.all([
        base44.entities.TimeEntry.list('-date', 200),
        base44.entities.WorkerProfile.filter({ status: 'active' }),
      ]);
      setEntries(e);
      setWorkers(w);
      setLoading(false);
    }
    load();
  }, []);

  const totalRegular = entries.reduce((s, e) => s + (e.regular_hours || 0), 0);
  const totalOT = entries.reduce((s, e) => s + (e.overtime_hours || 0), 0);
  const totalHours = entries.reduce((s, e) => s + (e.total_hours || 0), 0);

  // Hours by worker
  const byWorker = {};
  entries.forEach(e => {
    const name = e.worker_name || e.worker_email || 'Unknown';
    if (!byWorker[name]) byWorker[name] = { name, regular: 0, overtime: 0 };
    byWorker[name].regular += e.regular_hours || 0;
    byWorker[name].overtime += e.overtime_hours || 0;
  });
  const workerChart = Object.values(byWorker).slice(0, 10);

  // Hours by site
  const bySite = {};
  entries.forEach(e => {
    const site = e.site_name || 'No Site';
    if (!bySite[site]) bySite[site] = { name: site, value: 0 };
    bySite[site].value += e.total_hours || 0;
  });
  const siteChart = Object.values(bySite);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-8 animate-slide-up">
      <div>
        <h1 className="text-2xl font-bold font-display tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">Workforce analytics and insights</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard icon={Clock} label="Total Hours" value={formatHours(totalHours)} subtitle={`${entries.length} entries`} />
        <StatsCard icon={Clock} label="Regular Hours" value={formatHours(totalRegular)} />
        <StatsCard icon={DollarSign} label="Overtime Hours" value={formatHours(totalOT)} />
        <StatsCard icon={Users} label="Active Workers" value={workers.length} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold mb-4">Hours by Worker</h3>
          {workerChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={workerChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="regular" stackId="a" fill="hsl(152,45%,28%)" name="Regular" radius={[0, 0, 0, 0]} />
                <Bar dataKey="overtime" stackId="a" fill="hsl(36,80%,52%)" name="Overtime" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">No data yet</div>
          )}
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold mb-4">Hours by Site</h3>
          {siteChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={siteChart} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value">
                  {siteChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => formatHours(v)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">No data yet</div>
          )}
          <div className="flex flex-wrap gap-3 mt-2 justify-center">
            {siteChart.map((s, i) => (
              <div key={s.name} className="flex items-center gap-1.5 text-xs">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span>{s.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}