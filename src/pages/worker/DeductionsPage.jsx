import { useState, useEffect } from 'react';
import api from '@/api/apiClient';
import { TaxDeductions, WorkerProfiles } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Car, Home, Wrench, Phone, Utensils, Heart, PiggyBank, DollarSign } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';

const CATEGORIES = {
  mileage: { label: 'Mileage', icon: Car, rate: 0.67, note: '2024 IRS rate: $0.67/mile' },
  home_office: { label: 'Home Office', icon: Home, note: 'Dedicated workspace expenses' },
  equipment_tools: { label: 'Equipment & Tools', icon: Wrench, note: 'Tools used for work' },
  phone_internet: { label: 'Phone / Internet', icon: Phone, note: 'Business-use portion' },
  meals_entertainment: { label: 'Meals & Entertainment', icon: Utensils, note: '50% deductible for business meals' },
  health_insurance: { label: 'Health Insurance', icon: Heart, note: 'Self-employed health insurance premiums' },
  retirement: { label: 'Retirement Contributions', icon: PiggyBank, note: 'SEP-IRA, Solo 401k, SIMPLE IRA' },
  other: { label: 'Other Business Expense', icon: DollarSign, note: 'Miscellaneous ordinary and necessary expenses' },
};

export default function DeductionsPage() {
  const [deductions, setDeductions] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()));
  const [draft, setDraft] = useState({
    category: '', description: '', amount: '', miles: '', date: format(new Date(), 'yyyy-MM-dd'), notes: ''
  });

  useEffect(() => {
    async function load() {
      const me = await api.get('/api/auth/me').then(r => r.data);
      setUser(me);
      const d = await TaxDeductions.list({ worker_email: me.email, sort: '-date', limit: 200 });
      setDeductions(d);
      setLoading(false);
    }
    load();
  }, []);

  const filteredYear = deductions.filter(d => String(d.tax_year) === yearFilter);
  const totalByCategory = filteredYear.reduce((acc, d) => {
    acc[d.category] = (acc[d.category] || 0) + (d.amount || 0);
    return acc;
  }, {});
  const grandTotal = Object.values(totalByCategory).reduce((s, v) => s + v, 0);

  async function handleAdd() {
    setSaving(true);
    try {
      const profiles = await WorkerProfiles.list({ user_email: user.email });
      let amount = parseFloat(draft.amount) || 0;
      if (draft.category === 'mileage' && draft.miles) {
        amount = parseFloat(draft.miles) * 0.67;
      }
      await TaxDeductions.create({
        worker_email: user.email,
        worker_name: profiles[0]?.full_name || user.full_name || user.email,
        tax_year: parseInt(yearFilter),
        category: draft.category,
        description: draft.description,
        amount,
        miles: draft.miles ? parseFloat(draft.miles) : undefined,
        date: draft.date,
        notes: draft.notes,
      });
      const updated = await TaxDeductions.list({ worker_email: user.email, sort: '-date', limit: 200 });
      setDeductions(updated);
      setShowAdd(false);
      setDraft({ category: '', description: '', amount: '', miles: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '' });
      toast.success('Deduction saved');
    } finally {
      setSaving(false);
    }
  }

  const years = ['2024', '2025', '2026'];

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5 pb-8 animate-slide-up">
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-xl font-bold font-display">1099 Deductions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track self-employment tax deductions</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="w-4 h-4" /> Add</Button>
      </div>

      {/* Year selector */}
      <div className="flex gap-2">
        {years.map(y => (
          <button
            key={y}
            onClick={() => setYearFilter(y)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${yearFilter === y ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
          >
            {y}
          </button>
        ))}
      </div>

      {/* Info banner */}
      <div className="bg-info/5 border border-info/20 rounded-xl p-4">
        <p className="text-xs font-semibold text-info mb-1">How this helps you</p>
        <p className="text-xs text-muted-foreground">
          As a 1099 contractor, you pay self-employment tax (15.3%) on net income. Tracking deductible expenses lowers your taxable income, reducing your SE tax bill. Share this summary with your tax preparer.
        </p>
      </div>

      {/* Total + breakdown */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold">Total Deductions {yearFilter}</p>
          <p className="text-xl font-bold text-success">${grandTotal.toFixed(2)}</p>
        </div>
        <div className="space-y-2">
          {Object.entries(totalByCategory).map(([cat, total]) => {
            const { label, icon: Icon } = CATEGORIES[cat] || { label: cat, icon: DollarSign };
            return (
              <div key={cat} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
                  <Icon className="w-3.5 h-3.5 text-primary" />
                </div>
                <span className="text-xs flex-1 text-foreground">{label}</span>
                <span className="text-xs font-semibold">${total.toFixed(2)}</span>
              </div>
            );
          })}
        </div>
        {Object.keys(totalByCategory).length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No deductions recorded for {yearFilter}</p>
        )}
      </div>

      {/* Deduction list */}
      {filteredYear.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">All Entries</p>
          {filteredYear.map(d => {
            const { label, icon: Icon } = CATEGORIES[d.category] || { label: d.category, icon: DollarSign };
            return (
              <div key={d.id} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{d.description || label}</p>
                  <p className="text-xs text-muted-foreground">
                    {label} · {d.date ? format(parseISO(d.date), 'MMM d') : ''}
                    {d.miles ? ` · ${d.miles} miles` : ''}
                  </p>
                </div>
                <p className="text-sm font-semibold text-success shrink-0">${(d.amount || 0).toFixed(2)}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* SE Tax Estimate */}
      {grandTotal > 0 && (
        <div className="bg-success/5 border border-success/20 rounded-xl p-4">
          <p className="text-xs font-semibold text-success mb-1">Estimated Tax Savings</p>
          <p className="text-2xl font-bold text-success">${(grandTotal * 0.153 * 0.5).toFixed(2)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Approx. SE tax reduction at 15.3%. Consult your tax preparer for accurate figures.
          </p>
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Deduction</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={draft.category} onValueChange={v => setDraft(d => ({ ...d, category: v }))}>
                <SelectTrigger><SelectValue placeholder="Select category…" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORIES).map(([k, { label }]) => (
                    <SelectItem key={k} value={k}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {draft.category && <p className="text-xs text-muted-foreground">{CATEGORIES[draft.category]?.note}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input placeholder="e.g. Drive to Mesilla Valley Farm" value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={draft.date} onChange={e => setDraft(d => ({ ...d, date: e.target.value }))} />
            </div>
            {draft.category === 'mileage' ? (
              <div className="space-y-1.5">
                <Label>Miles Driven</Label>
                <Input type="number" placeholder="0" value={draft.miles} onChange={e => setDraft(d => ({ ...d, miles: e.target.value }))} />
                {draft.miles && <p className="text-xs text-success">= ${(parseFloat(draft.miles) * 0.67).toFixed(2)} at $0.67/mile</p>}
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Amount ($)</Label>
                <Input type="number" placeholder="0.00" value={draft.amount} onChange={e => setDraft(d => ({ ...d, amount: e.target.value }))} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Input placeholder="Additional details…" value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button disabled={!draft.category || saving || (draft.category !== 'mileage' && !draft.amount) || (draft.category === 'mileage' && !draft.miles)} onClick={handleAdd}>
              {saving ? 'Saving…' : 'Save Deduction'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
