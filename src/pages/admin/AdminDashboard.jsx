import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/api/apiClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Users, DollarSign, AlertTriangle, Lock,
  TrendingUp, Clock, RefreshCw, LogOut,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

function StatCard({ icon: Icon, label, value, sub, color = 'text-primary' }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm font-medium">{label}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function statusBadge(status, lockReason) {
  if (status === 'active') return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Active</Badge>;
  if (status === 'trial') return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Trial</Badge>;
  if (status === 'locked') return (
    <Badge className="bg-red-500/10 text-red-600 border-red-500/20">
      Locked{lockReason === 'trial_expired' ? ' (trial)' : ' (payment)'}
    </Badge>
  );
  return <Badge variant="secondary">{status}</Badge>;
}

export default function AdminDashboard() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const { data: res } = await api.get('/api/admin/stats');
      setData(res);
    } catch (err) {
      if (err.response?.status === 403) {
        setError('Access denied. Your account is not an admin.');
      } else {
        setError('Failed to load admin data.');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = data?.accounts?.filter(a => {
    const matchesSearch =
      a.owner_email.toLowerCase().includes(search.toLowerCase()) ||
      a.owner_name.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || a.status === filter;
    return matchesSearch && matchesFilter;
  }) ?? [];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <Lock className="w-12 h-12 text-destructive mx-auto" />
          <p className="text-lg font-semibold">{error}</p>
          <Button variant="outline" onClick={() => navigate('/')}>Go Home</Button>
        </div>
      </div>
    );
  }

  const { stats } = data;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="https://media.base44.com/images/public/69db595f420acc2fe622536d/9b4a5552a_cadence_logo_v3b.png"
            alt="Cadence"
            className="w-7 h-7 object-contain"
          />
          <span className="font-bold text-lg">Cadence Admin</span>
          <Badge variant="secondary" className="text-xs">Super Admin</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={load}>
            <RefreshCw className="w-4 h-4 mr-1" />Refresh
          </Button>
          <Button size="sm" variant="ghost" onClick={() => logout('/')}>
            <LogOut className="w-4 h-4 mr-1" />Sign Out
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard
            icon={Users}
            label="Total Accounts"
            value={stats.total}
            color="text-primary"
          />
          <StatCard
            icon={Clock}
            label="On Trial"
            value={stats.trial}
            sub={`${stats.trials_expiring_3d} expiring in 3d`}
            color="text-yellow-500"
          />
          <StatCard
            icon={TrendingUp}
            label="Active / Paid"
            value={stats.active}
            color="text-green-500"
          />
          <StatCard
            icon={Lock}
            label="Locked"
            value={stats.locked}
            color="text-red-500"
          />
          <StatCard
            icon={DollarSign}
            label="MRR"
            value={`$${stats.mrr.toLocaleString()}`}
            color="text-green-500"
          />
          <StatCard
            icon={AlertTriangle}
            label="Expiring (7d)"
            value={stats.trials_expiring_7d}
            color="text-orange-500"
          />
        </div>

        {/* Accounts Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <h2 className="font-semibold">All Accounts</h2>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Search name or email..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="border border-input rounded-md px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring w-full sm:w-56"
              />
              <select
                value={filter}
                onChange={e => setFilter(e.target.value)}
                className="border border-input rounded-md px-2 py-1.5 text-sm bg-background focus:outline-none"
              >
                <option value="all">All</option>
                <option value="trial">Trial</option>
                <option value="active">Active</option>
                <option value="locked">Locked</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Owner</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Plan</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Trial Left</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Signed Up</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                      No accounts found
                    </td>
                  </tr>
                )}
                {filtered.map(a => (
                  <tr key={a.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium">{a.owner_name}</p>
                      <p className="text-xs text-muted-foreground">{a.owner_email}</p>
                    </td>
                    <td className="px-5 py-3">
                      {statusBadge(a.status, a.lock_reason)}
                    </td>
                    <td className="px-5 py-3 capitalize">
                      {a.plan?.replace('_', ' ')}
                      {a.billing_interval === 'year' && (
                        <span className="ml-1 text-xs text-muted-foreground">(annual)</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {a.status === 'trial' && a.days_left !== null ? (
                        <span className={a.days_left <= 3 ? 'text-red-500 font-semibold' : a.days_left <= 7 ? 'text-orange-500' : ''}>
                          {a.days_left}d
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {new Date(a.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
