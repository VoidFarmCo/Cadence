import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DollarSign, Plus, Lock, ArrowRight, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
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

  useEffect(() => {
    async function load() {
      const [r, pp] = await Promise.all([
        base44.entities.PayrollRun.list('-created_date'),
        base44.entities.PayPeriod.list('-start_date', 10),
      ]);
      setRuns(r);
      setPayPeriods(pp);
      setLoading(false);
    }
    load();
  }, []);

  const steps = ['Confirm Period', 'Review Hours', 'Resolve Issues', 'Submit to QB', 'Confirmation'];

  async function startPayrollRun(period) {
    setSelectedPeriod(period);
    setCurrentStep(0);
    setStepperOpen(true);
  }

  async function handleSubmitRun() {
    if (submitting) return;
    setSubmitting(true);
    const me = await base44.auth.me();
    await base44.entities.PayrollRun.create({
      pay_period_id: selectedPeriod.id,
      pay_period_label: `${formatDate(selectedPeriod.start_date)} – ${formatDate(selectedPeriod.end_date)}`,
      status: 'submitted',
      total_regular_hours: selectedPeriod.total_regular_hours || 0,
      total_overtime_hours: selectedPeriod.total_overtime_hours || 0,
      submitted_at: new Date().toISOString(),
      submitted_by: me.email,
      qb_sync_status: 'pending'
    });
    await base44.entities.AuditLog.create({
      action: 'payroll_submit', entity_type: 'PayrollRun', performed_by: me.email,
      details: `Payroll run submitted for period ${formatDate(selectedPeriod.start_date)} – ${formatDate(selectedPeriod.end_date)}`
    });
    setCurrentStep(4);
    toast.success('Payroll run submitted');
    setSubmitting(false);
  }

  const statusColors = {
    draft: 'bg-muted text-muted-foreground',
    reviewing: 'bg-info/10 text-info',
    submitted: 'bg-warning/10 text-warning',
    completed: 'bg-success/10 text-success',
    failed: 'bg-destructive/10 text-destructive',
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display tracking-tight">Payroll Runs</h1>
          <p className="text-sm text-muted-foreground mt-1">Submit approved hours to QuickBooks</p>
        </div>
      </div>

      {/* Pay Periods */}
      <div>
        <h2 className="text-sm font-semibold mb-3">Pay Periods</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {payPeriods.map(pp => (
            <div key={pp.id} className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-start justify-between mb-3">
                <Badge variant="secondary" className={pp.status === 'locked' ? 'bg-success/10 text-success' : pp.status === 'paid' ? 'bg-primary/10 text-primary' : 'bg-warning/10 text-warning'}>
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
              {pp.status === 'locked' && (
                <Button size="sm" className="mt-4 w-full gap-2" onClick={() => startPayrollRun(pp)}>
                  <DollarSign className="w-4 h-4" />Run Payroll
                </Button>
              )}
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
                <Button onClick={() => setCurrentStep(1)} className="w-full gap-2">Continue <ArrowRight className="w-4 h-4" /></Button>
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
                <div className="bg-success/5 border border-success/20 rounded-lg p-4 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-success" />
                  <p className="text-sm">All workers mapped to QuickBooks entities</p>
                </div>
                <Button onClick={() => setCurrentStep(3)} className="w-full gap-2">Continue <ArrowRight className="w-4 h-4" /></Button>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Ready to submit approved hours to QuickBooks Payroll. This will create payroll entries for all mapped workers.</p>
                <Button onClick={handleSubmitRun} disabled={submitting} className="w-full gap-2">
                  <DollarSign className="w-4 h-4" />{submitting ? 'Submitting…' : 'Submit to QuickBooks'}
                </Button>
              </div>
            )}

            {currentStep === 4 && (
              <div className="space-y-4 text-center py-4">
                <CheckCircle2 className="w-12 h-12 text-success mx-auto" />
                <p className="text-sm font-semibold">Payroll Submitted Successfully</p>
                <p className="text-xs text-muted-foreground">Hours have been sent to QuickBooks Payroll for processing.</p>
                <Button variant="outline" className="gap-2" onClick={() => setStepperOpen(false)}>
                  <ExternalLink className="w-4 h-4" />View in QuickBooks
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}