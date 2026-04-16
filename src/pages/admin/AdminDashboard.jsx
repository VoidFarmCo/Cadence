import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/api/apiClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Users, DollarSign, AlertTriangle, Lock, Building2,
  TrendingUp, Clock, RefreshCw, LogOut, Shield, ChevronLeft,
  ChevronRight, Search, Unlock, CreditCard, UserCheck, ScrollText, Trash2,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

// ─── Stat card ───────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color = 'text-primary' }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex items-start gap-4">
      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
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

// ─── Badge helpers ───────────────────────────────────────────────────────────

function statusBadge(status, lockReason) {
  if (status === 'active') return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Active</Badge>;
  if (status === 'trial') return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Trial</Badge>;
  if (status === 'locked') return (
    <Badge className="bg-red-500/10 text-red-600 border-red-500/20">
      Locked{lockReason === 'trial_expired' ? ' (trial)' : lockReason === 'payment_failed' ? ' (payment)' : ''}
    </Badge>
  );
  if (status === 'cancelled') return <Badge className="bg-gray-500/10 text-gray-600 border-gray-500/20">Cancelled</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}

function platformRoleBadge(platformRole) {
  if (platformRole === 'superadmin') return <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20">Superadmin</Badge>;
  return <Badge variant="secondary">User</Badge>;
}

// ─── Pagination ──────────────────────────────────────────────────────────────

function Pagination({ page, total, limit, onPageChange }) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-border">
      <p className="text-xs text-muted-foreground">
        Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total}
      </p>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-sm px-2">Page {page} of {totalPages}</span>
        <Button size="sm" variant="ghost" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Tab navigation ──────────────────────────────────────────────────────────

const TABS = [
  { key: 'overview', label: 'Overview', icon: TrendingUp },
  { key: 'accounts', label: 'Accounts', icon: CreditCard },
  { key: 'companies', label: 'Companies', icon: Building2 },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'audit', label: 'Audit Logs', icon: ScrollText },
];

// ─── Main Dashboard ──────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Accounts tab state
  const [accounts, setAccounts] = useState([]);
  const [accountsTotal, setAccountsTotal] = useState(0);
  const [accountsPage, setAccountsPage] = useState(1);
  const [accountsSearch, setAccountsSearch] = useState('');
  const [accountsFilter, setAccountsFilter] = useState('all');

  // Companies tab state
  const [companies, setCompanies] = useState([]);
  const [companiesTotal, setCompaniesTotal] = useState(0);
  const [companiesPage, setCompaniesPage] = useState(1);
  const [companiesSearch, setCompaniesSearch] = useState('');

  // Users tab state
  const [users, setUsers] = useState([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [usersSearch, setUsersSearch] = useState('');

  // Audit tab state
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);

  // ─── Data loaders ──────────────────────────────────────────────────────────

  const loadStats = useCallback(async () => {
    try {
      const { data } = await api.get('/api/admin/stats');
      setStats(data.stats);
    } catch (err) {
      if (err.response?.status === 403) {
        setError('Access denied. Superadmin access required.');
      } else {
        setError('Failed to load admin data.');
      }
    }
  }, []);

  const loadAccounts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('page', String(accountsPage));
      params.set('limit', '25');
      if (accountsSearch) params.set('search', accountsSearch);
      if (accountsFilter !== 'all') params.set('status', accountsFilter);
      const { data } = await api.get(`/api/admin/accounts?${params}`);
      setAccounts(data.accounts);
      setAccountsTotal(data.total);
    } catch (err) {
      console.error('Load accounts failed:', err.response?.status, err.response?.data || err.message);
    }
  }, [accountsPage, accountsSearch, accountsFilter]);

  const loadCompanies = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('page', String(companiesPage));
      params.set('limit', '25');
      if (companiesSearch) params.set('search', companiesSearch);
      const { data } = await api.get(`/api/admin/companies?${params}`);
      setCompanies(data.companies);
      setCompaniesTotal(data.total);
    } catch (err) {
      console.error('Load companies failed:', err.response?.status, err.response?.data || err.message);
    }
  }, [companiesPage, companiesSearch]);

  const loadUsers = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('page', String(usersPage));
      params.set('limit', '25');
      if (usersSearch) params.set('search', usersSearch);
      const { data } = await api.get(`/api/admin/users?${params}`);
      setUsers(data.users);
      setUsersTotal(data.total);
    } catch (err) {
      console.error('Load users failed:', err.response?.status, err.response?.data || err.message);
    }
  }, [usersPage, usersSearch]);

  const loadAuditLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('page', String(auditPage));
      params.set('limit', '25');
      const { data } = await api.get(`/api/admin/audit-logs?${params}`);
      setAuditLogs(data.logs);
      setAuditTotal(data.total);
    } catch (err) {
      console.error('Load audit logs failed:', err.response?.status, err.response?.data || err.message);
    }
  }, [auditPage]);

  // ─── Initial load + tab change ─────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      setLoading(true);
      await loadStats();
      setLoading(false);
    }
    init();
  }, [loadStats]);

  useEffect(() => {
    if (tab === 'accounts') loadAccounts();
    if (tab === 'companies') loadCompanies();
    if (tab === 'users') loadUsers();
    if (tab === 'audit') loadAuditLogs();
  }, [tab, loadAccounts, loadCompanies, loadUsers, loadAuditLogs]);

  // ─── Quick actions ─────────────────────────────────────────────────────────

  async function updateAccountStatus(accountId, status) {
    try {
      await api.post(`/api/admin/accounts/${accountId}/update-status`, { status });
      loadAccounts();
      loadStats();
    } catch (err) {
      console.error('Update account status failed:', err.response?.status, err.response?.data || err.message);
      alert(err.response?.data?.error || `Failed to update account (${err.response?.status || 'network error'})`);
    }
  }

  async function togglePlatformRole(userId, currentRole) {
    const newRole = currentRole === 'superadmin' ? 'user' : 'superadmin';
    if (newRole === 'superadmin' && !confirm('Grant superadmin access to this user?')) return;
    if (newRole === 'user' && !confirm('Revoke superadmin access from this user?')) return;
    try {
      await api.post(`/api/admin/users/${userId}/set-role`, { platform_role: newRole });
      loadUsers();
    } catch (err) {
      console.error('Toggle platform role failed:', err.response?.status, err.response?.data || err.message);
      alert(err.response?.data?.error || `Failed to update role (${err.response?.status || 'network error'})`);
    }
  }

  async function deleteUser(userId, email) {
    if (!confirm(`Permanently delete ${email}? This removes their profile, audit logs, and user record. Cannot be undone.`)) return;
    try {
      await api.delete(`/api/admin/users/${userId}`);
      loadUsers();
      loadStats();
      alert(`Deleted user ${email}`);
    } catch (err) {
      console.error('Delete user failed:', err.response?.status, err.response?.data || err.message);
      alert(err.response?.data?.error || `Failed to delete user (${err.response?.status || 'network error'})`);
    }
  }

  async function purgeCompany(companyId, companyName) {
    if (!confirm(`Purge ALL data for ${companyName}? This deletes sites, workers, time entries, payroll, everything. Owner profile is preserved. Cannot be undone.`)) return;
    try {
      await api.delete(`/api/admin/companies/${companyId}/purge`);
      loadCompanies();
      loadStats();
      alert(`Purged all data for ${companyName}`);
    } catch (err) {
      console.error('Purge company failed:', err.response?.status, err.response?.data || err.message);
      alert(err.response?.data?.error || `Failed to purge company (${err.response?.status || 'network error'})`);
    }
  }

  // ─── Loading / Error states ────────────────────────────────────────────────

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

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/cadence-logo.png"
            alt="Cadence"
            className="w-7 h-7 object-contain"
          />
          <span className="font-bold text-lg">Cadence Admin</span>
          <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20 text-xs">
            <Shield className="w-3 h-3 mr-1" />Platform Admin
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => navigate('/')}>
            <Building2 className="w-4 h-4 mr-1" />Company View
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { loadStats(); if (tab === 'accounts') loadAccounts(); if (tab === 'companies') loadCompanies(); if (tab === 'users') loadUsers(); if (tab === 'audit') loadAuditLogs(); }}>
            <RefreshCw className="w-4 h-4 mr-1" />Refresh
          </Button>
          <Button size="sm" variant="ghost" onClick={() => logout('/login')}>
            <LogOut className="w-4 h-4 mr-1" />Sign Out
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* Tab nav */}
        <div className="flex gap-1 border-b border-border">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* ─── Overview Tab ─────────────────────────────────────────────── */}
        {tab === 'overview' && stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <StatCard icon={Building2} label="Companies" value={stats.total_companies} color="text-primary" />
            <StatCard icon={Users} label="Total Users" value={stats.total_users} color="text-blue-500" />
            <StatCard icon={CreditCard} label="Total Accounts" value={stats.total_accounts} color="text-primary" />
            <StatCard icon={Clock} label="On Trial" value={stats.trial} sub={`${stats.trials_expiring_3d} expiring in 3d`} color="text-yellow-500" />
            <StatCard icon={TrendingUp} label="Active / Paid" value={stats.active} color="text-green-500" />
            <StatCard icon={Lock} label="Locked" value={stats.locked} color="text-red-500" />
            <StatCard icon={DollarSign} label="MRR" value={`$${(stats.mrr || 0).toLocaleString()}`} color="text-green-500" />
            <StatCard icon={AlertTriangle} label="Expiring (7d)" value={stats.trials_expiring_7d} color="text-orange-500" />
          </div>
        )}

        {/* ─── Accounts Tab ────────────────────────────────────────────── */}
        {tab === 'accounts' && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <h2 className="font-semibold">All Accounts</h2>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-initial">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search name or email..."
                    value={accountsSearch}
                    onChange={e => { setAccountsSearch(e.target.value); setAccountsPage(1); }}
                    className="border border-input rounded-md pl-9 pr-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring w-full sm:w-56"
                  />
                </div>
                <select
                  value={accountsFilter}
                  onChange={e => { setAccountsFilter(e.target.value); setAccountsPage(1); }}
                  className="border border-input rounded-md px-2 py-1.5 text-sm bg-background focus:outline-none"
                >
                  <option value="all">All</option>
                  <option value="trial">Trial</option>
                  <option value="active">Active</option>
                  <option value="locked">Locked</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">Owner</th>
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">Company</th>
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">Plan</th>
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">Trial Left</th>
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">Created</th>
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.length === 0 && (
                    <tr><td colSpan={7} className="px-5 py-8 text-center text-muted-foreground">No accounts found</td></tr>
                  )}
                  {accounts.map(a => (
                    <tr key={a.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium">{a.owner_name}</p>
                        <p className="text-xs text-muted-foreground">{a.owner_email}</p>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{a.company_name || '—'}</td>
                      <td className="px-5 py-3">{statusBadge(a.status, a.lock_reason)}</td>
                      <td className="px-5 py-3 capitalize">
                        {a.plan?.replace('_', ' ')}
                        {a.billing_interval === 'year' && <span className="ml-1 text-xs text-muted-foreground">(annual)</span>}
                      </td>
                      <td className="px-5 py-3">
                        {a.status === 'trial' && a.days_left !== null ? (
                          <span className={a.days_left <= 3 ? 'text-red-500 font-semibold' : a.days_left <= 7 ? 'text-orange-500' : ''}>
                            {a.days_left}d
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1">
                          {a.status === 'locked' && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => updateAccountStatus(a.id, 'active')}>
                              <Unlock className="w-3 h-3 mr-1" />Unlock
                            </Button>
                          )}
                          {(a.status === 'active' || a.status === 'trial') && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600 hover:text-red-700" onClick={() => updateAccountStatus(a.id, 'locked')}>
                              <Lock className="w-3 h-3 mr-1" />Lock
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={accountsPage} total={accountsTotal} limit={25} onPageChange={setAccountsPage} />
          </div>
        )}

        {/* ─── Companies Tab ───────────────────────────────────────────── */}
        {tab === 'companies' && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <h2 className="font-semibold">All Companies</h2>
              <div className="relative w-full sm:w-auto">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search company or owner..."
                  value={companiesSearch}
                  onChange={e => { setCompaniesSearch(e.target.value); setCompaniesPage(1); }}
                  className="border border-input rounded-md pl-9 pr-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring w-full sm:w-56"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">Company</th>
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">Owner</th>
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">Plan</th>
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">Users</th>
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">Created</th>
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.length === 0 && (
                    <tr><td colSpan={7} className="px-5 py-8 text-center text-muted-foreground">No companies found</td></tr>
                  )}
                  {companies.map(c => (
                    <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3 font-medium">{c.name}</td>
                      <td className="px-5 py-3 text-muted-foreground">{c.owner_email}</td>
                      <td className="px-5 py-3 capitalize">{c.plan?.replace('_', ' ') || '—'}</td>
                      <td className="px-5 py-3">{c.status ? statusBadge(c.status) : '—'}</td>
                      <td className="px-5 py-3">{c.user_count}</td>
                      <td className="px-5 py-3 text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</td>
                      <td className="px-5 py-3">
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600 hover:text-red-700" onClick={() => purgeCompany(c.id, c.name)}>
                          <Trash2 className="w-3 h-3 mr-1" />Purge Data
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={companiesPage} total={companiesTotal} limit={25} onPageChange={setCompaniesPage} />
          </div>
        )}

        {/* ─── Users Tab ───────────────────────────────────────────────── */}
        {tab === 'users' && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <h2 className="font-semibold">All Users</h2>
              <div className="relative w-full sm:w-auto">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search name or email..."
                  value={usersSearch}
                  onChange={e => { setUsersSearch(e.target.value); setUsersPage(1); }}
                  className="border border-input rounded-md pl-9 pr-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring w-full sm:w-56"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">User</th>
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">Company</th>
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">Role</th>
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">Platform</th>
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">Joined</th>
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 && (
                    <tr><td colSpan={7} className="px-5 py-8 text-center text-muted-foreground">No users found</td></tr>
                  )}
                  {users.map(u => (
                    <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium">{u.full_name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{u.company?.name || '—'}</td>
                      <td className="px-5 py-3 capitalize">{u.role?.replace('_', ' ')}</td>
                      <td className="px-5 py-3">{platformRoleBadge(u.platform_role)}</td>
                      <td className="px-5 py-3">
                        {u.status === 'active' ? (
                          <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Active</Badge>
                        ) : u.status === 'pending' ? (
                          <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Pending</Badge>
                        ) : (
                          <Badge variant="secondary">{u.status}</Badge>
                        )}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => togglePlatformRole(u.id, u.platform_role)}
                          >
                            {u.platform_role === 'superadmin' ? (
                              <><UserCheck className="w-3 h-3 mr-1" />Revoke Admin</>
                            ) : (
                              <><Shield className="w-3 h-3 mr-1" />Make Admin</>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-red-600 hover:text-red-700"
                            onClick={() => deleteUser(u.id, u.email)}
                          >
                            <Trash2 className="w-3 h-3 mr-1" />Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={usersPage} total={usersTotal} limit={25} onPageChange={setUsersPage} />
          </div>
        )}

        {/* ─── Audit Logs Tab ──────────────────────────────────────────── */}
        {tab === 'audit' && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-semibold">Platform Audit Logs</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">Time</th>
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">Action</th>
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">Entity</th>
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">By</th>
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">Company</th>
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">No audit logs found</td></tr>
                  )}
                  {auditLogs.map(log => (
                    <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3 text-muted-foreground whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant="secondary" className="capitalize">{log.action}</Badge>
                      </td>
                      <td className="px-5 py-3 capitalize">{log.entity_type}</td>
                      <td className="px-5 py-3">
                        <p className="font-medium">{log.performer?.full_name}</p>
                        <p className="text-xs text-muted-foreground">{log.performer?.email}</p>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{log.company?.name || '—'}</td>
                      <td className="px-5 py-3 text-muted-foreground max-w-xs truncate">{log.details || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={auditPage} total={auditTotal} limit={25} onPageChange={setAuditPage} />
          </div>
        )}

      </div>
    </div>
  );
}
