import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Shield } from 'lucide-react';
import WorkerDocuments from './WorkerDocuments';

const statusColors = { active: 'bg-success/10 text-success', inactive: 'bg-muted text-muted-foreground', pending: 'bg-warning/10 text-warning' };
const roleLabels = { owner: 'Owner', payroll_admin: 'Payroll Admin', manager: 'Manager', worker: 'Worker' };

export default function WorkerDetailModal({ worker, open, onClose }) {
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
        </div>
      </DialogContent>
    </Dialog>
  );
}