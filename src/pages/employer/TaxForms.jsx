import { useState, useEffect } from 'react';
import api from '@/api/apiClient';
import { TaxForms as TaxFormsAPI, WorkerProfiles } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, Plus, CheckCircle2, Clock, AlertCircle, Eye, Paperclip } from 'lucide-react';
import { format } from 'date-fns';

const FORM_TEMPLATES = {
  'W-4': {
    description: "Employee's Withholding Certificate. Used to determine federal income tax withholding.",
    fields: [
      { key: 'legal_name', label: 'Legal Full Name', type: 'text', required: true },
      { key: 'ssn_last4', label: 'Last 4 digits of SSN', type: 'text', required: true },
      { key: 'address', label: 'Home Address', type: 'text', required: true },
      { key: 'filing_status', label: 'Filing Status', type: 'select', options: ['Single or Married filing separately', 'Married filing jointly', 'Head of household'], required: true },
      { key: 'extra_withholding', label: 'Additional Withholding Amount ($/paycheck)', type: 'number', required: false },
      { key: 'exempt', label: 'Claim Exemption from Withholding?', type: 'select', options: ['No', 'Yes — I claim exemption'], required: true },
      { key: 'signature_confirm', label: 'I certify this information is correct', type: 'checkbox', required: true },
    ]
  },
  'I-9': {
    description: "Employment Eligibility Verification. Required for all new hires to verify identity and work authorization.",
    fields: [
      { key: 'legal_name', label: 'Legal Full Name', type: 'text', required: true },
      { key: 'other_names', label: 'Other Last Names Used (if any)', type: 'text', required: false },
      { key: 'dob', label: 'Date of Birth', type: 'date', required: true },
      { key: 'address', label: 'Address', type: 'text', required: true },
      { key: 'citizenship_status', label: 'Citizenship / Immigration Status', type: 'select', options: ['U.S. Citizen', 'Noncitizen National', 'Lawful Permanent Resident', 'Alien authorized to work'], required: true },
      { key: 'document_type', label: 'Identity Document Type', type: 'select', options: ["Driver's License", 'U.S. Passport', 'Permanent Resident Card', 'Employment Auth. Document', 'Other'], required: true },
      { key: 'document_number', label: 'Document Number', type: 'text', required: true },
      { key: 'expiration_date', label: 'Document Expiration Date', type: 'date', required: false },
      { key: 'signature_confirm', label: 'I attest under penalty of perjury that this information is true', type: 'checkbox', required: true },
    ]
  },
  'W-9': {
    description: "Request for Taxpayer Identification Number. Required for contractors paid $600+ per year.",
    fields: [
      { key: 'legal_name', label: 'Legal Name (as shown on tax return)', type: 'text', required: true },
      { key: 'business_name', label: 'Business Name / DBA (if different)', type: 'text', required: false },
      { key: 'tax_classification', label: 'Federal Tax Classification', type: 'select', options: ['Individual / sole proprietor', 'C Corporation', 'S Corporation', 'Partnership', 'Trust/estate', 'LLC', 'Other'], required: true },
      { key: 'address', label: 'Address', type: 'text', required: true },
      { key: 'tin_type', label: 'TIN Type', type: 'select', options: ['Social Security Number (SSN)', 'Employer Identification Number (EIN)'], required: true },
      { key: 'tin_last4', label: 'Last 4 digits of TIN', type: 'text', required: true },
      { key: 'signature_confirm', label: 'I certify all information is accurate under penalty of perjury', type: 'checkbox', required: true },
    ]
  },
  'NM State Withholding': {
    description: "New Mexico State Income Tax Withholding form (NM RPD-41283).",
    fields: [
      { key: 'legal_name', label: 'Legal Full Name', type: 'text', required: true },
      { key: 'ssn_last4', label: 'Last 4 digits of SSN', type: 'text', required: true },
      { key: 'filing_status', label: 'NM Filing Status', type: 'select', options: ['Single', 'Married', 'Married — withhold at single rate', 'Head of household'], required: true },
      { key: 'nm_allowances', label: 'Number of NM Allowances', type: 'number', required: true },
      { key: 'extra_nm_withholding', label: 'Additional NM Withholding ($/paycheck)', type: 'number', required: false },
      { key: 'signature_confirm', label: 'I certify this information is correct', type: 'checkbox', required: true },
    ]
  },
  'Direct Deposit Auth': {
    description: "Authorization for direct deposit of paychecks to the employee's bank account.",
    fields: [
      { key: 'legal_name', label: 'Legal Full Name', type: 'text', required: true },
      { key: 'bank_name', label: 'Bank Name', type: 'text', required: true },
      { key: 'account_type', label: 'Account Type', type: 'select', options: ['Checking', 'Savings'], required: true },
      { key: 'routing_last4', label: 'Last 4 digits of Routing Number', type: 'text', required: true },
      { key: 'account_last4', label: 'Last 4 digits of Account Number', type: 'text', required: true },
      { key: 'signature_confirm', label: 'I authorize this direct deposit arrangement', type: 'checkbox', required: true },
    ]
  },
  'Custom': {
    description: "Custom form with a message from the employer.",
    fields: [
      { key: 'response', label: 'Your Response', type: 'textarea', required: true },
      { key: 'signature_confirm', label: 'I confirm my response is accurate', type: 'checkbox', required: true },
    ]
  }
};

// Map display names to backend enum values
const FORM_TYPE_TO_BACKEND = {
  'W-4': 'W4',
  'I-9': 'I9',
  'W-9': 'W9',
  'NM State Withholding': 'NM_State_Withholding',
  'Direct Deposit Auth': 'Direct_Deposit_Auth',
  'Custom': 'Custom',
};

const statusConfig = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  expired: { label: 'Expired', color: 'bg-red-100 text-red-800', icon: AlertCircle },
};

export default function TaxForms() {
  const [forms, setForms] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSend, setShowSend] = useState(false);
  const [showView, setShowView] = useState(null);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState({ form_type: '', worker_email: '', due_date: '', description: '' });

  useEffect(() => {
    Promise.all([
      TaxFormsAPI.list(),
      WorkerProfiles.list({ status: 'active' }),
    ]).then(([f, w]) => { setForms(f); setWorkers(w); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleSend = async () => {
    setSending(true);
    try {
      const me = await api.get('/api/auth/me').then(r => r.data);
      const worker = workers.find(w => w.user_email === draft.worker_email);
      const template = FORM_TEMPLATES[draft.form_type] || FORM_TEMPLATES['Custom'];
      await TaxFormsAPI.create({
        title: draft.form_type,
        form_type: FORM_TYPE_TO_BACKEND[draft.form_type] || 'Custom',
        description: draft.description || template.description,
        worker_email: draft.worker_email,
        worker_name: worker?.full_name || draft.worker_email,
        due_date: draft.due_date || undefined,
        fields_config: JSON.stringify(template.fields),
      });
      const updated = await TaxFormsAPI.list();
      setForms(updated);
      setShowSend(false);
      setDraft({ form_type: '', worker_email: '', due_date: '', description: '' });
    } catch (err) {
      console.error('Failed to send form:', err);
    } finally {
      setSending(false);
    }
  };

  const groupByWorker = forms.reduce((acc, f) => {
    const key = f.worker_name || f.worker_email;
    if (!acc[key]) acc[key] = [];
    acc[key].push(f);
    return acc;
  }, {});

  const pending = forms.filter(f => f.status === 'pending').length;
  const completed = forms.filter(f => f.status === 'completed').length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-display">Tax & HR Forms</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Send and track onboarding and tax forms for your team</p>
        </div>
        <Button onClick={() => setShowSend(true)}>
          <Plus className="w-4 h-4" /> Send Form
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Sent', value: forms.length, color: 'text-foreground' },
          { label: 'Awaiting Response', value: pending, color: 'text-yellow-600' },
          { label: 'Completed', value: completed, color: 'text-green-600' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Forms by worker */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Loading…</div>
      ) : forms.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No forms sent yet. Click "Send Form" to get started.</p>
        </div>
      ) : (
        Object.entries(groupByWorker).map(([workerName, workerForms]) => (
          <div key={workerName} className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3 bg-muted/40 border-b border-border">
              <p className="text-sm font-semibold text-foreground">{workerName}</p>
            </div>
            <div className="divide-y divide-border">
              {workerForms.map(form => {
                const sc = statusConfig[form.status] || statusConfig.pending;
                const Icon = sc.icon;
                return (
                  <div key={form.id} className="flex items-center justify-between px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{form.title}</p>
                        <p className="text-xs text-muted-foreground">
                          Sent {form.sent_at ? format(new Date(form.sent_at), 'MMM d, yyyy') : '—'}
                          {form.due_date && ` · Due ${format(new Date(form.due_date), 'MMM d')}`}
                          {form.completed_at && ` · Completed ${format(new Date(form.completed_at), 'MMM d')}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${sc.color}`}>
                        <Icon className="w-3 h-3" /> {sc.label}
                      </span>
                      {form.status === 'completed' && (
                        <Button size="sm" variant="outline" onClick={() => setShowView(form)}>
                          <Eye className="w-3 h-3" /> View
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Send Form Dialog */}
      <Dialog open={showSend} onOpenChange={setShowSend}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send Tax / HR Form</DialogTitle>
            <DialogDescription className="sr-only">Select a form type and assign it to a worker</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Form Type</Label>
              <Select value={draft.form_type} onValueChange={v => setDraft(d => ({ ...d, form_type: v }))}>
                <SelectTrigger><SelectValue placeholder="Select a form…" /></SelectTrigger>
                <SelectContent>
                  {Object.keys(FORM_TEMPLATES).map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {draft.form_type && (
                <p className="text-xs text-muted-foreground">{FORM_TEMPLATES[draft.form_type]?.description}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Assign To</Label>
              <Select value={draft.worker_email} onValueChange={v => setDraft(d => ({ ...d, worker_email: v }))}>
                <SelectTrigger><SelectValue placeholder="Select worker…" /></SelectTrigger>
                <SelectContent>
                  {workers.map(w => (
                    <SelectItem key={w.user_email} value={w.user_email}>{w.full_name} ({w.worker_type})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Due Date (optional)</Label>
              <Input type="date" value={draft.due_date} onChange={e => setDraft(d => ({ ...d, due_date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Custom Instructions (optional)</Label>
              <Input placeholder="Override default instructions…" value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSend(false)}>Cancel</Button>
            <Button disabled={!draft.form_type || !draft.worker_email || sending} onClick={handleSend}>
              {sending ? 'Sending…' : 'Send Form'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Response Dialog */}
      <Dialog open={!!showView} onOpenChange={() => setShowView(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{showView?.title} — Response</DialogTitle>
            <DialogDescription className="sr-only">View the submitted form response</DialogDescription>
          </DialogHeader>
          {showView?.response_data && (() => {
            let data, fields;
            try { data = JSON.parse(showView.response_data); } catch { data = {}; }
            try { fields = JSON.parse(showView.fields_config || '[]'); } catch { fields = []; }
            const uploadedUrl = data._uploaded_file_url;
            return (
              <div className="space-y-3 py-2">
                {fields.map(f => (
                  <div key={f.key} className="space-y-0.5">
                    <p className="text-xs font-medium text-muted-foreground">{f.label}</p>
                    <p className="text-sm text-foreground bg-muted/40 rounded-md px-3 py-2">
                      {f.type === 'checkbox' ? (data[f.key] ? '✓ Confirmed' : 'Not confirmed') : (data[f.key] || '—')}
                    </p>
                  </div>
                ))}
                {uploadedUrl && (
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium text-muted-foreground">Uploaded Document</p>
                    <a
                      href={uploadedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-primary bg-primary/5 border border-primary/20 rounded-md px-3 py-2 hover:bg-primary/10 transition-colors"
                    >
                      <Paperclip className="w-4 h-4 shrink-0" />
                      View Attached Document
                    </a>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  Submitted {showView.completed_at ? format(new Date(showView.completed_at), 'MMM d, yyyy h:mm a') : ''}
                </p>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
