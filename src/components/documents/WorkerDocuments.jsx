import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, Trash2, ExternalLink, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const DOC_TYPES = ['W-4', 'I-9', 'W-9', 'Contract', 'Certification', 'Direct Deposit Auth', 'Other'];

const DOC_COLORS = {
  'W-4': 'bg-blue-500/10 text-blue-600',
  'I-9': 'bg-purple-500/10 text-purple-600',
  'W-9': 'bg-indigo-500/10 text-indigo-600',
  'Contract': 'bg-warning/10 text-warning',
  'Certification': 'bg-success/10 text-success',
  'Direct Deposit Auth': 'bg-info/10 text-info',
  'Other': 'bg-muted text-muted-foreground',
};

export default function WorkerDocuments({ worker, readOnly = false }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ doc_type: '', title: '', notes: '', expiry_date: '' });
  const [file, setFile] = useState(null);

  useEffect(() => {
    if (worker?.user_email) loadDocs();
  }, [worker?.user_email]);

  async function loadDocs() {
    setLoading(true);
    const results = await base44.entities.WorkerDocument.filter({ worker_email: worker.user_email }, '-created_date');
    setDocs(results);
    setLoading(false);
  }

  async function handleUpload() {
    if (!form.doc_type || !form.title || !file) {
      toast.error('Document type, title, and file are required');
      return;
    }
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const me = await base44.auth.me();
    await base44.entities.WorkerDocument.create({
      worker_email: worker.user_email,
      worker_name: worker.full_name,
      doc_type: form.doc_type,
      title: form.title,
      file_url,
      file_name: file.name,
      notes: form.notes || undefined,
      expiry_date: form.expiry_date || undefined,
      uploaded_by: me.email,
    });
    toast.success('Document uploaded');
    setUploading(false);
    setDialogOpen(false);
    setForm({ doc_type: '', title: '', notes: '', expiry_date: '' });
    setFile(null);
    loadDocs();
  }

  async function handleDelete(doc) {
    if (!confirm(`Delete "${doc.title}"?`)) return;
    await base44.entities.WorkerDocument.delete(doc.id);
    setDocs(prev => prev.filter(d => d.id !== doc.id));
    toast.success('Document deleted');
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          Documents
          {docs.length > 0 && <span className="text-xs text-muted-foreground font-normal">({docs.length})</span>}
        </h3>
        {!readOnly && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5 h-9 min-w-11">
                <Plus className="w-4 h-4" />Upload
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Document for {worker.full_name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label>Document Type</Label>
                  <Select value={form.doc_type} onValueChange={v => setForm({ ...form, doc_type: v })}>
                    <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
                    <SelectContent>
                      {DOC_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. 2024 W-4 Form" />
                </div>
                <div className="space-y-2">
                  <Label>File</Label>
                  <Input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={e => setFile(e.target.files[0])} />
                </div>
                <div className="space-y-2">
                  <Label>Expiry Date <span className="text-muted-foreground">(optional)</span></Label>
                  <Input type="date" value={form.expiry_date} onChange={e => setForm({ ...form, expiry_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Notes <span className="text-muted-foreground">(optional)</span></Label>
                  <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Any notes..." />
                </div>
                <Button onClick={handleUpload} disabled={uploading} className="w-full gap-2">
                  <Upload className="w-4 h-4" />
                  {uploading ? 'Uploading...' : 'Upload Document'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <div className="py-4 flex justify-center">
          <div className="w-5 h-5 border-2 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : docs.length === 0 ? (
        <p className="text-sm text-muted-foreground py-3 text-center">No documents uploaded yet.</p>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => (
            <div key={doc.id} className="flex items-center gap-3 bg-muted/30 rounded-lg px-3 py-2.5">
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.title}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <Badge variant="secondary" className={`text-xs ${DOC_COLORS[doc.doc_type] || ''}`}>
                    {doc.doc_type}
                  </Badge>
                  {doc.expiry_date && (
                    <span className="text-xs text-muted-foreground">
                      Exp: {format(new Date(doc.expiry_date), 'MMM d, yyyy')}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(doc.created_date), 'MMM d, yyyy')}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                 <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                   <Button size="icon" variant="ghost" className="h-10 w-10" title="Open document">
                     <ExternalLink className="w-5 h-5" />
                   </Button>
                 </a>
                 {!readOnly && (
                   <Button size="icon" variant="ghost" className="h-10 w-10 text-destructive hover:text-destructive" onClick={() => handleDelete(doc)} title="Delete">
                     <Trash2 className="w-5 h-5" />
                   </Button>
                 )}
               </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}