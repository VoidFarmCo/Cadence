import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, Trash2 } from 'lucide-react';
import WorkerDocuments from './WorkerDocuments';
import { WorkerProfiles } from '@/api/entities';
import { toast } from 'sonner';

const statusColors = { active: 'bg-success/10 text-success', inactive: 'bg-muted text-muted-foreground', pending: 'bg-warning/10 text-warning' };
const roleLabels = { owner: 'Owner', payroll_admin: 'Payroll Admin', manager: 'Manager', worker: 'Worker' };

export default function WorkerDetailModal({ worker, open, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await WorkerProfiles.delete(worker.id);
      toast.success(`${worker.full_name} has been removed`);
    } catch (err) {
      // If record not found, treat as already deleted
      if (err?.message?.includes('not found')) {
        toast.success(`${worker.full_name} has been removed`);
      } else {
        toast.error('Failed to remove worker');
        setDeleting(false);
        return;
      }
    }
    setDeleting(false);
    onClose();
    if (onDeleted) onDeleted();
  }

  if (!worker) return null;
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                {worker.full_name?.charAt(0) || '?'}
              </div>
              <div>
                <p className="text-base font-semibold">{worker.full_name}</p>
                <p className="text-xs text-muted-foreground font-normal">{worker.user_email}</p>
              </div>
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">View and manage worker profile details</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Worker Details */}
          <div className="bg-muted/30 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />Details
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Type</p>
                <p className="text-sm font-medium capitalize">{worker.worker_type}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Role</p>
                <p className="text-sm font-medium">{roleLabels[worker.role] || worker.role}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pay Rate</p>
                <p className="text-sm font-medium">{worker.pay_rate ? `$${worker.pay_rate}/hr` : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge variant="secondary" className={`text-[10px] ${statusColors[worker.status] || ''}`}>
                  {worker.status}
                </Badge>
              </div>
              {worker.phone && (
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="text-sm font-medium">{worker.phone}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">PTO / Sick</p>
                <p className="text-sm font-medium">{worker.pto_balance || 0}h / {worker.sick_balance || 0}h</p>
              </div>
            </div>
          </div>

          {/* Documents */}
          <div className="bg-card rounded-xl border border-border p-4">
            <WorkerDocuments worker={worker} readOnly={false} />
          </div>

          {/* Danger Zone */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full gap-2" disabled={deleting}>
                <Trash2 className="w-4 h-4" />
                Remove {worker.worker_type === 'contractor' ? 'Contractor' : 'Worker'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove {worker.full_name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete their profile and cannot be undone. Their time entries and records will remain.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Yes, Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </DialogContent>
    </Dialog>
  );
}
