import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { FileText, CheckCircle2, Clock, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

export default function TaxFormPage() {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);
  const [responses, setResponses] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    const init = async () => {
      const me = await base44.auth.me();
      setUserEmail(me.email);
      const myForms = await base44.entities.TaxForm.filter({ worker_email: me.email });
      setForms(myForms);
      setLoading(false);
    };
    init();
  }, []);

  const openForm = (form) => {
    setActive(form);
    setResponses({});
    setSubmitted(false);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    await base44.entities.TaxForm.update(active.id, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      response_data: JSON.stringify(responses),
    });
    const updated = await base44.entities.TaxForm.filter({ worker_email: userEmail });
    setForms(updated);
    setSubmitted(true);
    setSubmitting(false);
  };

  const fields = active ? JSON.parse(active.fields_config || '[]') : [];
  const allRequired = fields.filter(f => f.required).every(f => {
    if (f.type === 'checkbox') return responses[f.key] === true;
    return responses[f.key] && String(responses[f.key]).trim() !== '';
  });

  const pending = forms.filter(f => f.status === 'pending');
  const completed = forms.filter(f => f.status === 'completed');

  if (active) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="bg-card border-b border-border px-4 py-4 flex items-center gap-3">
          <button onClick={() => setActive(null)} className="text-muted-foreground hover:text-foreground">
            ← Back
          </button>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-foreground">{active.title}</h2>
            {active.due_date && (
              <p className="text-xs text-muted-foreground">Due {format(new Date(active.due_date), 'MMM d, yyyy')}</p>
            )}
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
          {submitted ? (
            <div className="text-center py-16 space-y-3">
              <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto" />
              <h3 className="text-lg font-semibold text-foreground">Form Submitted!</h3>
              <p className="text-sm text-muted-foreground">Your response has been recorded and sent to your employer.</p>
              <Button onClick={() => setActive(null)} className="mt-4">Back to Forms</Button>
            </div>
          ) : (
            <>
              <div className="bg-muted/40 rounded-xl p-4 border border-border">
                <p className="text-sm text-foreground">{active.description}</p>
              </div>

              <div className="space-y-5">
                {fields.map(field => (
                  <div key={field.key} className="space-y-1.5">
                    <Label className="text-sm">
                      {field.label}
                      {field.required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    {field.type === 'text' && (
                      <Input
                        value={responses[field.key] || ''}
                        onChange={e => setResponses(r => ({ ...r, [field.key]: e.target.value }))}
                        placeholder={field.label}
                      />
                    )}
                    {field.type === 'number' && (
                      <Input
                        type="number"
                        value={responses[field.key] || ''}
                        onChange={e => setResponses(r => ({ ...r, [field.key]: e.target.value }))}
                        placeholder="0"
                      />
                    )}
                    {field.type === 'date' && (
                      <Input
                        type="date"
                        value={responses[field.key] || ''}
                        onChange={e => setResponses(r => ({ ...r, [field.key]: e.target.value }))}
                      />
                    )}
                    {field.type === 'textarea' && (
                      <textarea
                        className="w-full min-h-[100px] rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                        value={responses[field.key] || ''}
                        onChange={e => setResponses(r => ({ ...r, [field.key]: e.target.value }))}
                        placeholder={field.label}
                      />
                    )}
                    {field.type === 'select' && (
                      <Select
                        value={responses[field.key] || ''}
                        onValueChange={v => setResponses(r => ({ ...r, [field.key]: v }))}
                      >
                        <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                        <SelectContent>
                          {field.options.map(o => (
                            <SelectItem key={o} value={o}>{o}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {field.type === 'checkbox' && (
                      <div className="flex items-start gap-3 bg-muted/30 rounded-lg p-3 border border-border">
                        <Checkbox
                          id={field.key}
                          checked={!!responses[field.key]}
                          onCheckedChange={v => setResponses(r => ({ ...r, [field.key]: v }))}
                          className="mt-0.5"
                        />
                        <label htmlFor={field.key} className="text-sm text-foreground cursor-pointer leading-snug">
                          {field.label}
                        </label>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <Button
                className="w-full"
                disabled={!allRequired || submitting}
                onClick={handleSubmit}
              >
                {submitting ? 'Submitting…' : 'Submit Form'}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                By submitting, you confirm the information provided is accurate.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6 pb-24">
      <div>
        <h1 className="text-xl font-bold text-foreground font-display">Tax & HR Forms</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Forms sent to you by your employer</p>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Loading…</div>
      ) : forms.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No forms assigned yet.</p>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Action Required</h2>
              <div className="space-y-2">
                {pending.map(form => (
                  <button
                    key={form.id}
                    onClick={() => openForm(form)}
                    className="w-full bg-card border border-yellow-200 rounded-xl p-4 flex items-center justify-between gap-3 text-left hover:border-yellow-400 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-yellow-100 flex items-center justify-center">
                        <FileText className="w-4 h-4 text-yellow-700" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{form.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {form.sent_at ? `Received ${format(new Date(form.sent_at), 'MMM d')}` : ''}
                          {form.due_date ? ` · Due ${format(new Date(form.due_date), 'MMM d')}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Pending
                      </span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {completed.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Completed</h2>
              <div className="space-y-2">
                {completed.map(form => (
                  <div key={form.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{form.title}</p>
                        <p className="text-xs text-muted-foreground">
                          Submitted {form.completed_at ? format(new Date(form.completed_at), 'MMM d, yyyy') : ''}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-medium">Done</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}