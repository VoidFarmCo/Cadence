import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, CalendarOff } from 'lucide-react';
import { formatDate } from '@/lib/timeUtils';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { toast } from 'sonner';

export default function TimeOffPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ leave_type: 'pto', start_date: '', end_date: '', notes: '' });
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    async function load() {
      const me = await base44.auth.me();
      setUser(me);
      const [reqs, profiles] = await Promise.all([
        base44.entities.LeaveRequest.filter({ worker_email: me.email }, '-created_date'),
        base44.entities.WorkerProfile.filter({ user_email: me.email }),
      ]);
      setRequests(reqs);
      setProfile(profiles[0]);
      setLoading(false);
    }
    load();
  }, []);

  async function handleSubmit() {
    if (!form.start_date || !form.end_date) { toast.error('Select dates'); return; }
    if (form.end_date < form.start_date) { toast.error('End date must be after start date'); return; }
    try {
      const days = differenceInCalendarDays(parseISO(form.end_date), parseISO(form.start_date)) + 1;
      await base44.entities.LeaveRequest.create({
        worker_email: user.email,
        worker_name: user.full_name || profile?.full_name,
        leave_type: form.leave_type,
        start_date: form.start_date,
        end_date: form.end_date,
        total_days: days,
        total_hours: days * 8,
        notes: form.notes,
        status: 'pending'
      });
      toast.success('Leave request submitted');
      setDialogOpen(false);
      setForm({ leave_type: 'pto', start_date: '', end_date: '', notes: '' });
      const reqs = await base44.entities.LeaveRequest.filter({ worker_email: user.email }, '-created_date');
      setRequests(reqs);
    } catch (err) {
      toast.error('Failed to submit leave request');
    }
  }

  const typeLabels = { pto: 'PTO', sick: 'Sick', unpaid: 'Unpaid' };
  const statusColors = { pending: 'bg-warning/10 text-warning', approved: 'bg-success/10 text-success', denied: 'bg-destructive/10 text-destructive' };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold font-display">Time Off</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="w-4 h-4" />Request</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Request Time Off</DialogTitle><DialogDescription className="sr-only">Submit a new time off request</DialogDescription></DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.leave_type} onValueChange={v => setForm({ ...form, leave_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pto">PTO</SelectItem>
                    <SelectItem value="sick">Sick</SelectItem>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Reason for time off..." />
              </div>
              <Button onClick={handleSubmit} className="w-full">Submit Request</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Balances */}
      {profile && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-xl border border-border p-4 text-center">
            <p className="text-xs text-muted-foreground">PTO Balance</p>
            <p className="text-2xl font-bold font-display mt-1">{profile.pto_balance || 0}h</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 text-center">
            <p className="text-xs text-muted-foreground">Sick Balance</p>
            <p className="text-2xl font-bold font-display mt-1">{profile.sick_balance || 0}h</p>
          </div>
        </div>
      )}

      {/* Request History */}
      <div className="space-y-3">
        {requests.map(req => (
          <div key={req.id} className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{typeLabels[req.leave_type] || req.leave_type}</Badge>
                  <Badge variant="secondary" className={`text-[10px] capitalize ${statusColors[req.status] || ''}`}>{req.status}</Badge>
                </div>
                <p className="text-sm mt-2">{formatDate(req.start_date)} – {formatDate(req.end_date)}</p>
                <p className="text-xs text-muted-foreground">{req.total_days} day{req.total_days !== 1 ? 's' : ''}</p>
              </div>
            </div>
            {req.notes && <p className="text-xs text-muted-foreground mt-2">{req.notes}</p>}
            {req.denial_reason && <p className="text-xs text-destructive mt-2">Denied: {req.denial_reason}</p>}
          </div>
        ))}
        {requests.length === 0 && (
          <div className="bg-card rounded-xl border border-border py-12 text-center">
            <CalendarOff className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No time off requests</p>
          </div>
        )}
      </div>
    </div>
  );
}