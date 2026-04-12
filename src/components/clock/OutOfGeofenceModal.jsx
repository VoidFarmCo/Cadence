import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { OOG_REASONS } from '@/lib/geoUtils';

export default function OutOfGeofenceModal({ open, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');

  function handleConfirm() {
    if (!reason) return;
    onConfirm(reason, note);
    setReason('');
    setNote('');
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Out of Geofence</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          You appear to be outside the site boundary. Please select a reason to continue.
        </p>
        <div className="space-y-4 mt-3">
          <RadioGroup value={reason} onValueChange={setReason}>
            {OOG_REASONS.map(r => (
              <div key={r.value} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                <RadioGroupItem value={r.value} id={r.value} />
                <Label htmlFor={r.value} className="text-sm cursor-pointer flex-1">{r.label}</Label>
              </div>
            ))}
          </RadioGroup>

          {(reason === 'other' || reason) && (
            <div className="space-y-2">
              <Label>{reason === 'other' ? 'Note (required)' : 'Note (optional)'}</Label>
              <Textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Add details..."
                rows={2}
              />
            </div>
          )}

          <Button
            onClick={handleConfirm}
            disabled={!reason || (reason === 'other' && !note)}
            className="w-full"
          >
            Continue with Punch
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}