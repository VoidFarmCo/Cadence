import { useState, useEffect } from 'react';
import { PayrollRuns, WorkerProfiles, TimeEntries } from '@/api/entities';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, Clock, Users, TrendingUp, AlertCircle } from 'lucide-react';
import { formatDate, formatHours } from '@/lib/timeUtils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const statusColors = {
  draft: 'bg-muted text-muted-foreground',
  reviewing: 'bg-info/10 text-info',
  submitted: 'bg-warning/10 text-warning',
  completed: 'bg-success/10 text-success',
  failed: 'bg-destructive/10 text-destructive',
};

function StatCard({ icon: Icon, label, value, sub, color = 'text-primary' }) {
  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg bg-primary/10 ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold font-display">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

export default function PayrollAnalytics() {
  const [runs, setRuns] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState('all');

  useEffect(() => {
    async function load() {
      const [r, w, t] = await Promise.all([
        PayrollRuns.list({ sort: '-created_date', limit: 50 }),
        WorkerProfiles.list({ status: 'active' }),
        TimeEntries.list({ status: 'approved', sort: '-date', limit: 200 }),
      ]);
      setRuns(r);
      setWorkers(w);
      setTimeEntries(t);
      setLoading(false);
    }
    load();
  }, []);

  // Build pay-rate lookup
  const rateByEmail = {};
  workers.forEach(w => { if (w.pay_rate) rateByEmail[w.user_email] = w.pay_rate; });

  // Filter time entries by period
  const filteredEntries = periodFilter === 'all'
    ? timeEntries
    : timeEntries.filter(e => e.pay_period_id === periodFilter);

  // Per-worker aggregation
  const workerMap = {};
  filteredEntries.forEach(e => {
    if (!workerMap[e.worker_email]) {
      workerMap[e.worker_email] = {
        name: e.worker_name || e.worker_email,
        email: e.worker_email,
        regular: 0,
        overtime: 0,
        rate: rateByEmail[e.worker_email] || 0,
      };
    }
    workerMap[e.worker_email].regular += e.regular_hours || 0;
    workerMap[e.worker_email].overtime += e.overtime_hours || 0;
  });

  const workerRows = Object.values(workerMap)
    .map(w => ({
      ...w,
      totalHours: w.regular + w.overtime,
      estCost: w.rate ? (w.regular * w.rate + w.overtime * w.rate * 1.5) : null,
    }))
    .sort((a, b) => b.totalHours - a.totalHours);

  // Summary stats
  const totalRegular = workerRows.reduce((s, w) => s + w.regular, 0);
  const totalOvertime = workerRows.reduce((s, w) => s + w.overtime, 0);
  const totalEstCost = workerRows.reduce((s, w) => s + (w.estCost || 0), 0);
  const workersWithRates = workerRows.filter(w => w.estCost !== null).length;

  // Chart data — recent 8 runs
  const chartData = [...runs].slice(0, 8).reverse().map(r => ({
    label: r.pay_period_label?.split(' – ')[0] || formatDate(r.created_date),
    Regular: parseFloat((r.total_regular_hours || 0).toFixed(1)),
    Overtime: parseFloat((r.total_overtime_hours || 0).toFixed(1)),
  }));

  // Unique pay periods for filter
  const periods = [...new Map(timeEntries.filter(e => e.pay_period_id).map(e => [e.pay_period_id, e])).values()];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display tracking-tight">Payroll Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Labor cost overview and hours breakdown</p>
        </div>
        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="All Periods" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Periods</SelectItem>
            {periods.map(e => (
              <SelectItem key={e.pay_period_id} value={e.pay_period_id}>
                {e.pay_period_id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={DollarSign}
          label="Est. Total Labor Cost"
          value={workersWithRates > 0 ? `$${totalEstCost.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}
          sub={workersWithRates < workerRows.length ? `${workerRows.length - workersWithRates} worker(s) missing pay rate` : 'Based on pay rates × hours'}
        />
        <StatCard
          icon={Clock}
          label="Total Hours"
          value={formatHours(totalRegular + totalOvertime)}
          sub={`${formatHours(totalRegular)} reg + ${formatHours(totalOvertime)} OT`}
          color="text-info"
        />
        <StatCard
          icon={TrendingUp}
          label="Overtime Hours"
          value={formatHours(totalOvertime)}
          sub={`${totalRegular + totalOvertime > 0 ? ((totalOvertime / (totalRegular + totalOvertime)) * 100).toFixed(1) : 0}% of total`}
          color="text-warning"
        />
        <StatCard
          icon={Users}
          label="Active Workers"
          value={workerRows.length}
          sub={`${runs.length} total payroll runs`}
          color="text-success"
        />
      </div>

      {/* Hours Trend Chart */}
      {chartData.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold mb-4">Hours by Pay Period (last {chartData.length} runs)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Regular" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Overtime" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Per-Worker Hours Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold">Hours by Worker</h2>
        </div>
        {workerRows.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">No approved time entries found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Worker</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-5 py-3">Regular</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-5 py-3">Overtime</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-5 py-3">Total</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-5 py-3 hidden sm:table-cell">Pay Rate</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-5 py-3 hidden md:table-cell">Est. Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {workerRows.map(w => (
                  <tr key={w.email} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium">{w.name}</p>
                      <p className="text-xs text-muted-foreground">{w.email}</p>
                    </td>
                    <td className="px-5 py-3 text-sm text-right">{formatHours(w.regular)}</td>
                    <td className="px-5 py-3 text-sm text-right">
                      {w.overtime > 0
                        ? <span className="text-warning font-medium">{formatHours(w.overtime)}</span>
                        : <span className="text-muted-foreground">—</span>
                      }
                    </td>
                    <td className="px-5 py-3 text-sm font-semibold text-right">{formatHours(w.totalHours)}</td>
                    <td className="px-5 py-3 text-sm text-right text-muted-foreground hidden sm:table-cell">
                      {w.rate ? `$${w.rate}/hr` : <span className="text-destructive/60 flex items-center justify-end gap-1"><AlertCircle className="w-3 h-3" />Not set</span>}
                    </td>
                    <td className="px-5 py-3 text-sm font-medium text-right hidden md:table-cell">
                      {w.estCost !== null ? `$${w.estCost.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Payroll Runs */}
      {runs.length > 0 && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold">Recent Payroll Runs</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Period</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-5 py-3">Regular</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-5 py-3">Overtime</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3 hidden sm:table-cell">Submitted</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3 hidden md:table-cell">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {runs.map(run => (
                  <tr key={run.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3 text-sm font-medium">{run.pay_period_label || '—'}</td>
                    <td className="px-5 py-3 text-sm text-right">{formatHours(run.total_regular_hours)}</td>
                    <td className="px-5 py-3 text-sm text-right text-warning">{formatHours(run.total_overtime_hours)}</td>
                    <td className="px-5 py-3">
                      <Badge variant="secondary" className={`text-[10px] capitalize ${statusColors[run.status] || ''}`}>
                        {run.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-sm text-muted-foreground hidden sm:table-cell">
                      {run.submitted_at ? formatDate(run.submitted_at) : '—'}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground hidden md:table-cell">
                      {run.submitted_by || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
