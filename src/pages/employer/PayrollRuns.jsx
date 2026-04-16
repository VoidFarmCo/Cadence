import { useState, useEffect } from 'react';
import api from '@/api/apiClient';
import { PayrollRuns as PayrollRunsAPI, PayPeriods, TimeEntries } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DollarSign, Lock, Unlock, ArrowRight, CheckCircle2, Download, FileText } from 'lucide-react';
import { formatDate, formatHours } from '@/lib/timeUtils';
import { toast } from 'sonner';

export default function PayrollRuns() {
  const [runs, setRuns] = useState([]);
  const [payPeriods, setPayPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stepperOpen, setStepperOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [periodEntries, setPeriodEntries] = useState([]);

  async function loadData() {
    try {
      const [r, pp] = await Promise.all([
        PayrollRunsAPI.list(),
        PayPeriods.list(),
      ]);
      setRuns(r);
      setPayPeriods(pp);
    } catch (err) {
      console.error('Failed to load payroll data', err);
    }
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  const steps = ['Confirm Period', 'Review Hours', 'Export', 'Confirmation'];

  async function handleLockPeriod(period) {
    try {
      // Lock the period and let the backend aggregate hours
      const updated = await PayPeriods.update(period.id, { status: 'locked' });
      setPayPeriods(prev => prev.map(p => p.id === updated.id ? updated : p));
      toast.success('Pay period locked');
    } catch (err) {
      toast.error('Failed to lock pay period');
    }
  }

  async function handleUnlockPeriod(period) {
    try {
      const updated = await PayPeriods.update(period.id, { status: 'open', unlock_reason: 'Unlocked for corrections' });
      setPayPeriods(prev => prev.map(p => p.id === updated.id ? updated : p));
      toast.success('Pay period unlocked');
    } catch (err) {
      toast.error('Failed to unlock pay period');
    }
  }

  async function startPayrollRun(period) {
    setSelectedPeriod(period);
    setCurrentStep(0);
    setPeriodEntries([]);
    setStepperOpen(true);
  }

  async function handleContinueToReview() {
    // Fetch approved time entries to show accurate totals
    try {
      const entries = await TimeEntries.list({ pay_period_id: selectedPeriod.id, status: 'approved' });
      setPeriodEntries(entries);

      // Calculate totals from entries
      const workerEmails = new Set(entries.map(e => e.worker_email));
      const totalRegular = entries.reduce((sum, e) => sum + (e.regular_hours || 0), 0);
      const totalOvertime = entries.reduce((sum, e) => sum + (e.overtime_hours || 0), 0);

      setSelectedPeriod(prev => ({
        ...prev,
        total_regular_hours: totalRegular,
        total_overtime_hours: totalOvertime,
        worker_count: workerEmails.size,
      }));
    } catch (err) {
      console.error('Failed to load entries', err);
    }
    setCurrentStep(1);
  }

  async function handleExportAndFinalize(format) {
    if (submitting) return;
    setSubmitting(true);

    try {
      const entries = periodEntries.length > 0
        ? periodEntries
        : await TimeEntries.list({ pay_period_id: selectedPeriod.id, status: 'approved' });

      if (format === 'csv') {
        const rows = [['Worker Name', 'Worker Email', 'Date', 'Regular Hours', 'Overtime Hours', 'Site']];
        entries.forEach(e => rows.push([e.worker_name, e.worker_email, e.date, e.regular_hours || 0, e.overtime_hours || 0, e.site_name || '']));
        const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = `payroll_${selectedPeriod.start_date?.substring(0, 10)}_to_${selectedPeriod.end_date?.substring(0, 10)}.csv`;
        a.click(); URL.revokeObjectURL(url);
      } else {
        const lines = ['!TIMTRK\tTRKTYPE\tNAME\tDURATION\tDATE\tPROJNAME'];
        entries.forEach(e => {
          const hours = (e.regular_hours || 0) + (e.overtime_hours || 0);
          const dateStr = e.date?.substring(0, 10).replace(/-/g, '/') || '';
          lines.push(`TIMTRK\tTIME\t${e.worker_name}\t${hours}\t${dateStr}\t${e.site_name || ''}`);
        });
        const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = `payroll_${selectedPeriod.start_date?.substring(0, 10)}_to_${selectedPeriod.end_date?.substring(0, 10)}.iif`;
        a.click(); URL.revokeObjectURL(url);
      }

      // Record the payroll run
      const newRun = await PayrollRunsAPI.create({
        pay_period_id: selectedPeriod.id,
        pay_period_label: `${formatDate(selectedPeriod.start_date)} – ${formatDate(selectedPeriod.end_date)}`,
        status: 'completed',
        total_regular_hours: selectedPeriod.total_regular_hours || 0,
        total_overtime_hours: selectedPeriod.total_overtime_hours || 0,
        submitted_at: new Date().toISOString(),
        submitted_by: 'current_user',
      });

      setRuns(prev => [newRun, ...prev]);
      setCurrentStep(3);
      toast.success(`Payroll exported as ${format.toUpperCase()}`);
    } catch (err) {
      toast.error('Failed to export payroll: ' + (err.response?.data?.error || err.message || 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  }

  const statusColors = {
    draft: 'bg-muted text-muted-foreground',
    reviewing: 'bg-info/10 text-info',
    submitted: 'bg-warning/10 text-warning',
    completed: 'bg-success/10 text-success',
    failed: 'bg-destructive/10 text-destructive',
  };

  const periodStatusColors = {
    open: 'bg-warning/10 text-warning',
    locked: 'bg-success/10 text-success',
    paid: 'bg-primary/10 text-primary',
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display tracking-tight">Payroll Runs</h1>
          <p className="text-sm text-muted-foreground mt-1">Export approved hours as CSV or IIF for your payroll software</p>
        </div>
      </div>

      {/* Pay Periods */}
      <div>
        <h2 className="text-sm font-semibold mb-3">Pay Periods</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {payPeriods.map(pp => (
            <div key={pp.id} className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-start justify-between mb-3">
                <Badge variant="secondary" className={periodStatusColors[pp.status] || ''}>
                  {pp.status === 'locked' && <Lock className="w-3 h-3 mr-1" />}
                  {pp.status}
                </Badge>
              </div>
              <p className="text-sm font-semibold">{formatDate(pp.start_date)} – {formatDate(pp.end_date)}</p>
              <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                <span>{formatHours(pp.total_regular_hours)} reg</span>
                <span>{formatHours(pp.total_overtime_hours)} OT</span>
                <span>{pp.worker_count || 0} workers</span>
              </div>
              <div className="mt-4 flex gap-2">
                {pp.status === 'open' && (
                  <Button size="sm" variant="outline" className="gap-2" onClick={() => handleLockPeriod(pp)}>
                    <Lock className="w-3 h-3" />Lock Period
                  </Button>
                )}
                {pp.status === 'locked' && (
                  <>
                    <Button size="sm" className="gap-2 flex-1" onClick={() => startPayrollRun(pp)}>
                      <DollarSign className="w-4 h-4" />Run Payroll
                    </Button>
                    <Button size="sm" variant="ghost" className="gap-1" onClick={() => handleUnlockPeriod(pp)}>
                      <Unlock className="w-3 h-3" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
        {payPeriods.length === 0 && (
          <div className="bg-card rounded-xl border border-border py-12 text-center text-sm text-muted-foreground">
            No pay periods configured. Set up your pay schedule in Settings.
          </div>
        )}
      </div>

      {/* Past Runs */}
      {runs.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3">Past Runs</h2>
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Period</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Hours</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3 hidden sm:table-cell">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {runs.map(run => (
                  <tr key={run.id} className="hover:bg-muted/20">
                    <td className="px-5 py-3 text-sm">{run.pay_period_label}</td>
                    <td className="px-5 py-3 text-sm">{formatHours(run.total_regular_hours)} + {formatHours(run.total_overtime_hours)} OT</td>
                    <td className="px-5 py-3"><Badge variant="secondary" className={`text-[10px] capitalize ${statusColors[run.status] || ''}`}>{run.status}</Badge></td>
                    <td className="px-5 py-3 text-sm text-muted-foreground hidden sm:table-cell">{formatDate(run.submitted_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payroll Run Stepper */}
      <Dialog open={stepperOpen} onOpenChange={setStepperOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Payroll Run</DialogTitle></DialogHeader>
          <div className="mt-4">
            {/* Stepper */}
            <div className="flex items-center justify-between mb-6">
              {steps.map((step, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    i < currentStep ? 'bg-success text-success-foreground' : i === currentStep ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}>
                    {i < currentStep ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                  </div>
                  {i < steps.length - 1 && <div className={`hidden sm:block w-8 h-0.5 ${i < currentStep ? 'bg-success' : 'bg-muted'}`} />}
                </div>
              ))}
            </div>
            <p className="text-sm font-semibold mb-2">{steps[currentStep]}</p>

            {currentStep === 0 && (
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm">Period: <strong>{formatDate(selectedPeriod?.start_date)} – {formatDate(selectedPeriod?.end_date)}</strong></p>
                  <p className="text-sm mt-1">Status: <Badge variant="secondary" className="bg-success/10 text-success ml-1">{selectedPeriod?.status}</Badge></p>
                </div>
                <Button onClick={handleContinueToReview} className="w-full gap-2">Continue <ArrowRight className="w-4 h-4" /></Button>
              </div>
            )}

            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm"><span>Regular Hours</span><strong>{formatHours(selectedPeriod?.total_regular_hours || 0)}</strong></div>
                  <div className="flex justify-between text-sm"><span>Overtime Hours</span><strong>{formatHours(selectedPeriod?.total_overtime_hours || 0)}</strong></div>
                  <div className="flex justify-between text-sm"><span>Workers</span><strong>{selectedPeriod?.worker_count || 0}</strong></div>
                </div>
                <Button onClick={() => setCurrentStep(2)} className="w-full gap-2">Continue <ArrowRight className="w-4 h-4" /></Button>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Choose an export format to download payroll data for this period.</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleExportAndFinalize('csv')}
                    disabled={submitting}
                    className="flex flex-col items-center gap-2 border border-border rounded-xl p-5 hover:bg-muted/50 transition disabled:opacity-50 relative"
                  >
                    {submitting ? <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /> : <FileText className="w-8 h-8 text-primary" />}
                    <span className="text-sm font-semibold">CSV</span>
                    <span className="text-xs text-muted-foreground text-center">Universal spreadsheet format</span>
                  </button>
                  <button
                    onClick={() => handleExportAndFinalize('iif')}
                    disabled={submitting}
                    className="flex flex-col items-center gap-2 border border-border rounded-xl p-5 hover:bg-muted/50 transition disabled:opacity-50 relative"
                  >
                    <Download className="w-8 h-8 text-primary" />
                    <span className="text-sm font-semibold">IIF</span>
                    <span className="text-xs text-muted-foreground text-center">Generic payroll import format</span>
                  </button>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-4 text-center py-4">
                <CheckCircle2 className="w-12 h-12 text-success mx-auto" />
                <p className="text-sm font-semibold">Export Complete</p>
                <p className="text-xs text-muted-foreground">Your payroll file has been downloaded. Import it into your payroll software to process payments.</p>
                <Button className="w-full" onClick={() => { setStepperOpen(false); loadData(); }}>Done</Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
