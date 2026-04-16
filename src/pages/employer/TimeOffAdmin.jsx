import { useState, useEffect } from 'react';
import api from '@/api/apiClient';
import { LeaveRequests } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Check, X } from 'lucide-react';
import { formatDate } from '@/lib/timeUtils';
import { toast } from 'sonner';

export default function TimeOffAdmin() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [denyDialog, setDenyDialog] = useState(null);
  const [denyReason, setDenyReason] = useState('');

  useEffect(() => {
    LeaveRequests.list({ sort: '-created_date' }).then(r => { setRequests(r); setLoading(false); });
  }, []);

  async function handleApprove(req) {
    try {
      await api.post(`/api/leave-requests/${req.id}/review`, { status: 'approved' });
      setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'approved' } : r));
      toast.success('Leave approved');
    } catch (err) {
      toast.error('Failed to approve leave request');
    }
  }

  async function handleDeny() {
    if (!denyReason) { toast.error('Reason required'); return; }
    try {
      await api.post(`/api/leave-requests/${denyDialog.id}/review`, { status: 'denied', denial_reason: denyReason });
      setRequests(prev => prev.map(r => r.id === denyDialog.id ? { ...r, status: 'denied' } : r));
      setDenyDialog(null);
      setDenyReason('');
      toast.success('Leave denied');
    } catch (err) {
      toast.error('Failed to deny leave request');
    }
  }

  const typeLabels = { pto: 'PTO', sick: 'Sick', unpaid: 'Unpaid' };
  const statusColors = { pending: 'bg-warning/10 text-warning', approved: 'bg-success/10 text-success', denied: 'bg-destructive/10 text-destructive' };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-2xl font-bold font-display tracking-tight">Time Off Requests</h1>
        <p className="text-sm text-muted-foreground mt-1">{requests.filter(r => r.status === 'pending').length} pending</p>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Worker</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Type</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Dates</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3 hidden sm:table-cell">Notes</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Status</th>
                <th className="text-right text-xs font-medium text-muted-foreground px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {requests.map(req => (
                <tr key={req.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3 text-sm font-medium">{req.worker_name || req.worker_email}</td>
                  <td className="px-5 py-3"><Badge variant="outline" className="text-xs">{typeLabels[req.leave_type] || req.leave_type}</Badge></td>
                  <td className="px-5 py-3 text-sm">{formatDate(req.start_date)} – {formatDate(req.end_date)}</td>
                  <td className="px-5 py-3 text-sm text-muted-foreground hidden sm:table-cell max-w-48 truncate">{req.notes || '—'}</td>
                  <td className="px-5 py-3">
                    <Badge variant="secondary" className={`text-[10px] capitalize ${statusColors[req.status] || ''}`}>{req.status}</Badge>
                  </td>
                  <td className="px-5 py-3">
                    {req.status === 'pending' && (
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-success hover:bg-success/10" onClick={() => handleApprove(req)}>
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => setDenyDialog(req)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {requests.length === 0 && <div className="py-12 text-center text-sm text-muted-foreground">No leave requests</div>}
      </div>

      <Dialog open={!!denyDialog} onOpenChange={() => { setDenyDialog(null); setDenyReason(''); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Deny Leave Request</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <Label>Reason</Label>
            <Textarea value={denyReason} onChange={e => setDenyReason(e.target.value)} placeholder="Reason for denial..." />
            <Button variant="destructive" onClick={handleDeny} className="w-full">Deny Request</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
