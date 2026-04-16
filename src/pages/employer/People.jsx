import { useState, useEffect, useCallback } from 'react';
import PullToRefresh from '@/components/PullToRefresh';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { UserPlus, Search } from 'lucide-react';
import { toast } from 'sonner';
import WorkerDetailModal from '@/components/documents/WorkerDetailModal';

export default function People() {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [form, setForm] = useState({ full_name: '', user_email: '', phone: '', worker_type: 'employee', role: 'worker', pay_rate: '' });

  useEffect(() => {
    loadWorkers();
  }, []);

  async function loadWorkers() {
    const w = await base44.entities.WorkerProfile.list('-created_date');
    setWorkers(w);
    setLoading(false);
  }

  const filtered = workers.filter(w =>
    w.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    w.user_email?.toLowerCase().includes(search.toLowerCase())
  );

  async function handleInvite() {
    if (!form.full_name || !form.user_email) {
      toast.error('Name and email are required');
      return;
    }
    await base44.functions.invoke('inviteWorker', {
      email: form.user_email,
      appRole: form.role,
      full_name: form.full_name,
      phone: form.phone,
      worker_type: form.worker_type,
      pay_rate: form.pay_rate,
    });
    toast.success(`Invited ${form.full_name}`);
    setDialogOpen(false);
    setForm({ full_name: '', user_email: '', phone: '', worker_type: 'employee', role: 'worker', pay_rate: '' });
    loadWorkers();
  }

  const statusColors = { active: 'bg-success/10 text-success', inactive: 'bg-muted text-muted-foreground', pending: 'bg-warning/10 text-warning' };
  const roleLabels = { owner: 'Owner', payroll_admin: 'Payroll Admin', manager: 'Manager', worker: 'Worker' };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <PullToRefresh onRefresh={loadWorkers}>
    <div className="space-y-6 animate-slide-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display tracking-tight">People</h1>
          <p className="text-sm text-muted-foreground mt-1">{workers.length} team member{workers.length !== 1 ? 's' : ''}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="w-4 h-4" />
              Invite Worker
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Team Member</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="John Smith" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.user_email} onChange={e => setForm({ ...form, user_email: e.target.value })} placeholder="john@example.com" />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="(505) 555-1234" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={form.worker_type} onValueChange={v => setForm({ ...form, worker_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="contractor">Contractor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={form.role} onValueChange={v => setForm({ ...form, role: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="worker">Worker</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="payroll_admin">Payroll Admin</SelectItem>
                      <SelectItem value="owner">Owner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Pay Rate ($/hr)</Label>
                <Input type="number" value={form.pay_rate} onChange={e => setForm({ ...form, pay_rate: e.target.value })} placeholder="15.00" />
              </div>
              <Button onClick={handleInvite} className="w-full">Send Invite</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search people..." className="pl-10" />
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Name</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3 hidden sm:table-cell">Type</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3 hidden md:table-cell">Role</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3 hidden lg:table-cell">Rate</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(w => (
                <tr key={w.id} className="hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => setSelectedWorker(w)}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {w.full_name?.charAt(0) || '?'}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{w.full_name}</p>
                        <p className="text-xs text-muted-foreground">{w.user_email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 hidden sm:table-cell">
                    <span className="text-sm capitalize">{w.worker_type}</span>
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell">
                    <span className="text-sm">{roleLabels[w.role] || w.role}</span>
                  </td>
                  <td className="px-5 py-3.5 hidden lg:table-cell">
                    <span className="text-sm">{w.pay_rate ? `$${w.pay_rate}/hr` : '—'}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge variant="secondary" className={`text-[10px] ${statusColors[w.status] || ''}`}>
                      {w.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {search ? 'No results found' : 'No team members yet. Invite your first worker!'}
          </div>
        )}
      </div>

      <WorkerDetailModal
        worker={selectedWorker}
        open={!!selectedWorker}
        onClose={() => setSelectedWorker(null)}
        onDeleted={() => { setSelectedWorker(null); loadWorkers(); }}
      />
    </div>
    </PullToRefresh>
  );
}