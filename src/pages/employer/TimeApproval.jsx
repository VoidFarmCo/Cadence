import { useState, useEffect } from 'react';
import PullToRefresh from '@/components/PullToRefresh';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Check, X, Clock, AlertTriangle, Wifi, WifiOff } from 'lucide-react';
import { formatDate, formatTime, formatHours } from '@/lib/timeUtils';
import { toast } from 'sonner';

export default function TimeApproval() {
  const [entries, setEntries] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterWorker, setFilterWorker] = useState('all');
  const [filterStatus, setFilterStatus] = useState('submitted');
  const [editDialog, setEditDialog] = useState(null);
  const [editReason, setEditReason] = useState('');

  async function load() {
    const [e, w] = await Promise.all([
      base44.entities.TimeEntry.list('-date', 100),
      base44.entities.WorkerProfile.filter({ status: 'active' }),
    ]);
    setEntries(e);
    setWorkers(w);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = entries.filter(e => {
    if (filterWorker !== 'all' && e.worker_email !== filterWorker) return false;
    if (filterStatus !== 'all' && e.status !== filterStatus) return false;
    return true;
  });

  async function handleApprove(entry) {
    try {
      const me = await base44.auth.me();
      await base44.entities.TimeEntry.update(entry.id, { status: 'approved' });
      await base44.entities.AuditLog.create({
        action: 'approval',
        entity_type: 'TimeEntry',
        entity_id: entry.id,
        performed_by: me.email,
        details: `Approved time entry for ${entry.worker_name} on ${entry.date}`
      });
      setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'approved' } : e));
      toast.success('Entry approved');
    } catch (err) {
      toast.error('Failed to approve entry');
    }
  }

  async function handleReject(entry) {
    if (!editReason) { toast.error('Reason is required'); return; }
    try {
      const me = await base44.auth.me();
      await base44.entities.TimeEntry.update(entry.id, { status: 'rejected', edit_reason: editReason });
      await base44.entities.AuditLog.create({
        action: 'approval',
        entity_type: 'TimeEntry',
        entity_id: entry.id,
        performed_by: me.email,
        reason: editReason,
        details: `Rejected time entry for ${entry.worker_name} on ${entry.date}`
      });
      setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'rejected' } : e));
      setEditDialog(null);
      setEditReason('');
      toast.success('Entry rejected');
    } catch (err) {
      toast.error('Failed to reject entry');
    }
  }

  const statusColors = {
    pending: 'bg-muted text-muted-foreground',
    submitted: 'bg-info/10 text-info',
    approved: 'bg-success/10 text-success',
    rejected: 'bg-destructive/10 text-destructive',
    corrected: 'bg-warning/10 text-warning',
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <PullToRefresh onRefresh={load}>
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-2xl font-bold font-display tracking-tight">Time Approval</h1>
        <p className="text-sm text-muted-foreground mt-1">Review and approve worker time entries</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={filterWorker} onValueChange={setFilterWorker}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All Workers" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Workers</SelectItem>
            {workers.map(w => <SelectItem key={w.user_email} value={w.user_email}>{w.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Worker</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Date</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3 hidden sm:table-cell">Hours</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3 hidden md:table-cell">Site</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3 hidden lg:table-cell">Flags</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Status</th>
                <th className="text-right text-xs font-medium text-muted-foreground px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(entry => (
                <tr key={entry.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium">{entry.worker_name || entry.worker_email}</p>
                  </td>
                  <td className="px-5 py-3 text-sm">{formatDate(entry.date)}</td>
                  <td className="px-5 py-3 text-sm hidden sm:table-cell">
                    <span>{formatHours(entry.total_hours)}</span>
                    {entry.overtime_hours > 0 && (
                      <span className="text-sm text-warning ml-1">+{formatHours(entry.overtime_hours)} OT</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-sm text-muted-foreground hidden md:table-cell">{entry.site_name || '—'}</td>
                  <td className="px-5 py-3 hidden lg:table-cell">
                    <div className="flex gap-1">
                      {entry.has_exception && (
                        <Badge variant="outline" className="text-xs border-warning text-warning gap-1">
                          <AlertTriangle className="w-3 h-3" />Exception
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <Badge variant="secondary" className={`text-xs capitalize ${statusColors[entry.status] || ''}`}>
                      {entry.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-3">
                    {entry.status === 'submitted' && (
                      <div className="flex items-center justify-end gap-2">
                        <Button size="icon" variant="ghost" className="h-10 w-10 text-success hover:bg-success/10" onClick={() => handleApprove(entry)} title="Approve">
                          <Check className="w-5 h-5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-10 w-10 text-destructive hover:bg-destructive/10" onClick={() => setEditDialog(entry)} title="Reject">
                          <X className="w-5 h-5" />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">No time entries match your filters</div>
        )}
      </div>

      <Dialog open={!!editDialog} onOpenChange={() => { setEditDialog(null); setEditReason(''); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Time Entry</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              Rejecting entry for <strong>{editDialog?.worker_name}</strong> on {formatDate(editDialog?.date)}
            </p>
            <div className="space-y-2">
              <Label>Reason (required)</Label>
              <Textarea value={editReason} onChange={e => setEditReason(e.target.value)} placeholder="Please explain why this entry is being rejected..." />
            </div>
            <Button variant="destructive" onClick={() => handleReject(editDialog)} className="w-full">Reject Entry</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </PullToRefresh>
  );
}