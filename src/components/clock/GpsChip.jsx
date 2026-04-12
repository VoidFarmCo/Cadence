import { cn } from '@/lib/utils';
import { MapPin, WifiOff, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function GpsChip({ status }) {
  // status: 'ok' | 'no_gps' | 'outside' | 'offline' | 'loading'
  const config = {
    ok: { icon: CheckCircle2, text: 'GPS OK', bg: 'bg-success/10', fg: 'text-success' },
    no_gps: { icon: MapPin, text: 'No GPS', bg: 'bg-destructive/10', fg: 'text-destructive' },
    outside: { icon: AlertTriangle, text: 'Outside Geofence', bg: 'bg-warning/10', fg: 'text-warning' },
    offline: { icon: WifiOff, text: 'Offline', bg: 'bg-muted', fg: 'text-muted-foreground' },
    loading: { icon: MapPin, text: 'Getting location...', bg: 'bg-muted', fg: 'text-muted-foreground' },
  };

  const c = config[status] || config.loading;
  const Icon = c.icon;

  return (
    <div className={cn("inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium", c.bg, c.fg)}>
      <Icon className="w-3.5 h-3.5" />
      <span>{c.text}</span>
    </div>
  );
}