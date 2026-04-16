import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Plus, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays, parseISO } from 'date-fns';

export default function Settings() {
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({});

  useEffect(() => {
    async function load() {
      const companies = await base44.entities.Company.list('-created_date', 1);
      if (companies.length > 0) {
        setCompany(companies[0]);
        setForm(companies[0]);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave() {
    try {
      if (company) {
        await base44.entities.Company.update(company.id, form);
        toast.success('Settings saved');
      } else {
        const created = await base44.entities.Company.create(form);
        setCompany(created);
        toast.success('Company created');
      }
    } catch (err) {
      toast.error('Failed to save settings');
    }
  }

  async function generatePayPeriods() {
    if (!form.pay_period_start_date) {
      toast.error('Set a pay period start date first');
      return;
    }
    try {
      const start = parseISO(form.pay_period_start_date);
      const periods = [];
      for (let i = 0; i < 6; i++) {
        const pStart = addDays(start, i * 14);
        const pEnd = addDays(pStart, 13);
        periods.push({
          start_date: format(pStart, 'yyyy-MM-dd'),
          end_date: format(pEnd, 'yyyy-MM-dd'),
          status: 'open'
        });
      }
      // bulkCreate may not exist on all SDK versions, fall back to individual creates
      if (base44.entities.PayPeriod.bulkCreate) {
        await base44.entities.PayPeriod.bulkCreate(periods);
      } else {
        for (const period of periods) {
          await base44.entities.PayPeriod.create(period);
        }
      }
      toast.success('6 pay periods created');
    } catch (err) {
      toast.error('Failed to generate pay periods');
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-8 animate-slide-up max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold font-display tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Company configuration and integrations</p>
      </div>

      {/* Company Info */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-5">
        <div className="flex items-center gap-3 mb-2">
          <Building2 className="w-5 h-5 text-primary" />
          <h2 className="text-sm font-semibold">Company Information</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Company Name</Label>
            <Input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Address</Label>
            <Input value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>City</Label>
            <Input value={form.city || ''} onChange={e => setForm({ ...form, city: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>State</Label>
              <Input value={form.state || 'NM'} onChange={e => setForm({ ...form, state: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>ZIP</Label>
              <Input value={form.zip || ''} onChange={e => setForm({ ...form, zip: e.target.value })} />
            </div>
          </div>
        </div>
      </div>

      {/* Pay Period */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-5">
        <div className="flex items-center gap-3 mb-2">
          <Calendar className="w-5 h-5 text-primary" />
          <h2 className="text-sm font-semibold">Pay Period Configuration</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Workweek Start</Label>
            <Select value={form.workweek_start || 'sunday'} onValueChange={v => setForm({ ...form, workweek_start: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sunday">Sunday</SelectItem>
                <SelectItem value="monday">Monday</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>OT Threshold (hrs/week)</Label>
            <Input type="number" value={form.overtime_threshold || 40} onChange={e => setForm({ ...form, overtime_threshold: parseInt(e.target.value) })} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Pay Period Start Date</Label>
            <Input type="date" value={form.pay_period_start_date || ''} onChange={e => setForm({ ...form, pay_period_start_date: e.target.value })} />
          </div>
        </div>
        <Button variant="outline" onClick={generatePayPeriods} className="gap-2">
          <Plus className="w-4 h-4" />Generate 6 Pay Periods
        </Button>
      </div>


      <Button onClick={handleSave} className="w-full sm:w-auto">Save Settings</Button>
    </div>
  );
}