import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export default function TrialBanner({ account }) {
  const navigate = useNavigate();

  if (!account || account.status !== 'trial') return null;

  const daysLeft = Math.max(0, Math.ceil(
    (new Date(account.trial_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  ));

  const urgent = daysLeft <= 3;

  return (
    <div className={`w-full px-4 py-2 flex items-center justify-between gap-3 text-sm ${urgent ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning-foreground'}`}>
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>
          {daysLeft === 0
            ? 'Your trial expires today.'
            : `Your free trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`}
          {' '}Upgrade to keep access.
        </span>
      </div>
      <Button size="sm" variant={urgent ? 'destructive' : 'default'} onClick={() => navigate('/billing')} className="shrink-0">
        Upgrade Now
      </Button>
    </div>
  );
}
