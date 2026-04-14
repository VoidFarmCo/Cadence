import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Receipt, Camera, DollarSign } from 'lucide-react';
import { formatDate } from '@/lib/timeUtils';
import { toast } from 'sonner';

const CATEGORIES = [
  { value: 'fuel', label: 'Fuel' },
  { value: 'supplies', label: 'Supplies' },
  { value: 'repairs', label: 'Repairs' },
  { value: 'tools', label: 'Tools' },
  { value: 'mileage', label: 'Mileage' },
  { value: 'other', label: 'Other' },
];

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ category: 'fuel', amount: '', date: '', notes: '' });
  const [receiptFile, setReceiptFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    async function load() {
      const me = await base44.auth.me();
      setUser(me);
      const exps = await base44.entities.Expense.filter({ worker_email: me.email }, '-date');
      setExpenses(exps);
      setLoading(false);
    }
    load();
  }, []);

  async function handleSubmit() {
    if (!form.amount || !form.date) { toast.error('Amount and date required'); return; }
    setSubmitting(true);

    // Optimistic update
    const optimisticId = `temp-${Date.now()}`;
    const optimisticExpense = {
      id: optimisticId,
      worker_email: user.email,
      category: form.category,
      amount: parseFloat(form.amount),
      date: form.date,
      notes: form.notes,
      status: 'pending',
      _optimistic: true,
    };
    setExpenses(prev => [optimisticExpense, ...prev]);
    setDialogOpen(false);
    setForm({ category: 'fuel', amount: '', date: '', notes: '' });
    setReceiptFile(null);

    let receiptUrl;
    if (receiptFile) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: receiptFile });
      receiptUrl = file_url;
    }
    const profiles = await base44.entities.WorkerProfile.filter({ user_email: user.email });
    const created = await base44.entities.Expense.create({
      worker_email: user.email,
      worker_name: user.full_name || profiles[0]?.full_name,
      category: form.category,
      amount: parseFloat(form.amount),
      date: form.date,
      notes: form.notes,
      receipt_url: receiptUrl,
      status: 'pending'
    });
    // Replace optimistic entry with real one
    setExpenses(prev => prev.map(e => e.id === optimisticId ? created : e));
    toast.success('Expense added');
    setSubmitting(false);
  }

  const total = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const categoryIcons = { fuel: '⛽', supplies: '📦', repairs: '🔧', tools: '🛠️', mileage: '🚗', other: '📋' };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold font-display">Expenses</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="w-4 h-4" />Add</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Expense</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Amount ($)</Label>
                  <Input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Description..." rows={2} />
              </div>
              <div className="space-y-2">
                <Label>Receipt</Label>
                <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    id="receipt-upload"
                    onChange={e => setReceiptFile(e.target.files[0])}
                  />
                  <label htmlFor="receipt-upload" className="cursor-pointer">
                    <Camera className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">
                      {receiptFile ? receiptFile.name : 'Tap to take photo or upload'}
                    </p>
                  </label>
                </div>
              </div>
              <Button onClick={handleSubmit} disabled={submitting} className="w-full">
                {submitting ? 'Uploading...' : 'Add Expense'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Total */}
      <div className="bg-card rounded-xl border border-border p-4 text-center">
        <p className="text-xs text-muted-foreground">Total Expenses</p>
        <p className="text-2xl font-bold font-display mt-1">${total.toFixed(2)}</p>
      </div>

      {/* Expense List */}
      <div className="space-y-3">
        {expenses.map(exp => (
          <div key={exp.id} className="bg-card rounded-xl border border-border p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xl">{categoryIcons[exp.category] || '📋'}</span>
              <div>
                <p className="text-sm font-medium capitalize">{exp.category}</p>
                <p className="text-xs text-muted-foreground">{formatDate(exp.date)}</p>
                {exp.notes && <p className="text-xs text-muted-foreground mt-0.5">{exp.notes}</p>}
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold">${exp.amount?.toFixed(2)}</p>
              <Badge variant="secondary" className={`text-[9px] capitalize mt-1 ${
                exp.status === 'approved' ? 'bg-success/10 text-success' : exp.status === 'rejected' ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning'
              }`}>{exp.status}</Badge>
            </div>
          </div>
        ))}
        {expenses.length === 0 && (
          <div className="bg-card rounded-xl border border-border py-12 text-center">
            <Receipt className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No expenses logged</p>
          </div>
        )}
      </div>
    </div>
  );
}