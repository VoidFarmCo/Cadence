import { useState, useEffect } from 'react';
import { Companies } from '@/api/entities';
import api from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Plus, Calendar } from 'lucide-react';
import { toast } from 'sonner';

export default function Settings() {
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({});
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const companies = await Companies.list();
        if (companies.length > 0) {
          const c = companies[0];
          setCompany(c);
          setForm({
            ...c,
            // Normalize date for the date input (strip time if present)
            pay_period_start_date: c.pay_period_start_date
              ? c.pay_period_start_date.substring(0, 10)
              : '',
          });
        }
      } catch (err) {
        console.error('Failed to load company', err);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave() {
    try {
      // Build payload with only the fields the backend accepts
      const payload = {};
      const fields = ['name', 'phone', 'address', 'city', 'state', 'zip',
        'pay_period_type', 'workweek_start'];
      for (const f of fields) {
        if (form[f] !== undefined && form[f] !== null && form[f] !== '') {
          payload[f] = form[f];
        }
      }
      if (form.overtime_threshold) {
        payload.overtime_threshold = parseInt(form.overtime_threshold, 10);
      }
      if (form.pay_period_start_date) {
        // Send as ISO datetime string for backend parsing
        payload.pay_period_start_date = form.pay_period_start_date;
      }

      if (company) {
        const updated = await Companies.update(company.id, payload);
        setCompany(updated);
        toast.success('Settings saved');
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
    // Save settings first so backend has up-to-date config
    await handleSave();

    setGenerating(true);
    try {
      const res = await api.post('/api/pay-periods/generate', { count: 6 });
      const periods = res.data;
      toast.success(`${periods.length} pay period(s) created`);
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to generate pay periods';
      toast.error(msg);
    } finally {
      setGenerating(false);
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
            <Label>Pay Period Type</Label>
            <Select value={form.pay_period_type || 'biweekly'} onValueChange={v => setForm({ ...form, pay_period_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="biweekly">Bi-weekly</SelectItem>
                <SelectItem value="semimonthly">Semi-monthly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
          <div className="space-y-2">
            <Label>Pay Period Start Date</Label>
            <Input type="date" value={form.pay_period_start_date || ''} onChange={e => setForm({ ...form, pay_period_start_date: e.target.value })} />
          </div>
        </div>
        <Button variant="outline" onClick={generatePayPeriods} disabled={generating} className="gap-2">
          <Plus className="w-4 h-4" />{generating ? 'Generating...' : 'Generate 6 Pay Periods'}
        </Button>
      </div>


      <Button onClick={handleSave} className="w-full sm:w-auto">Save Settings</Button>
    </div>
  );
}
