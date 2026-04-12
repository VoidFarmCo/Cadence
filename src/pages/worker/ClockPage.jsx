import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import GpsChip from '@/components/clock/GpsChip';
import OutOfGeofenceModal from '@/components/clock/OutOfGeofenceModal';
import { getCurrentPosition, isWithinGeofence } from '@/lib/geoUtils';
import { LogIn, Coffee, Play, LogOut } from 'lucide-react';
import { toast } from 'sonner';

export default function ClockPage() {
  const [sites, setSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState('');
  const [gpsStatus, setGpsStatus] = useState('loading');
  const [position, setPosition] = useState(null);
  const [lastPunch, setLastPunch] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [oogOpen, setOogOpen] = useState(false);
  const [pendingPunchType, setPendingPunchType] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function init() {
      const me = await base44.auth.me();
      setUser(me);
      const [s, profiles, punches] = await Promise.all([
        base44.entities.Site.filter({ status: 'active' }),
        base44.entities.WorkerProfile.filter({ user_email: me.email }),
        base44.entities.Punch.filter({ worker_email: me.email }, '-created_date', 1),
      ]);
      setSites(s);
      const p = profiles[0];
      setProfile(p);
      if (p?.default_site_id) setSelectedSite(p.default_site_id);
      else if (s.length > 0) setSelectedSite(s[0].id);
      if (punches.length > 0) setLastPunch(punches[0]);
    }
    init();
  }, []);

  const refreshGps = useCallback(async () => {
    setGpsStatus('loading');
    if (!navigator.onLine) { setGpsStatus('offline'); return; }
    try {
      const pos = await getCurrentPosition();
      setPosition(pos);
      const site = sites.find(s => s.id === selectedSite);
      if (site) {
        const inFence = isWithinGeofence(pos.latitude, pos.longitude, site.latitude, site.longitude, site.radius_meters);
        setGpsStatus(inFence ? 'ok' : 'outside');
      } else {
        setGpsStatus('ok');
      }
    } catch {
      setGpsStatus('no_gps');
    }
  }, [sites, selectedSite]);

  useEffect(() => { if (sites.length > 0) refreshGps(); }, [refreshGps, sites]);

  function getPunchSequence() {
    if (!lastPunch) return 'clock_in';
    const typeOrder = { clock_in: 'break_start', break_start: 'break_end', break_end: 'clock_out', clock_out: 'clock_in' };
    return typeOrder[lastPunch.punch_type] || 'clock_in';
  }

  async function handlePunch(punchType, oogReason, oogNote) {
    const site = sites.find(s => s.id === selectedSite);
    const isOutside = gpsStatus === 'outside';
    const isOffline = !navigator.onLine;

    if (isOutside && !oogReason) {
      setPendingPunchType(punchType);
      setOogOpen(true);
      return;
    }

    const now = new Date().toISOString();
    const punchData = {
      worker_email: user.email,
      worker_name: user.full_name || profile?.full_name || user.email,
      punch_type: punchType,
      timestamp: now,
      device_timestamp: now,
      latitude: position?.latitude,
      longitude: position?.longitude,
      gps_accuracy: position?.accuracy,
      site_id: selectedSite || undefined,
      site_name: site?.name || undefined,
      out_of_geofence: isOutside,
      out_of_geofence_reason: oogReason || undefined,
      note: oogNote || undefined,
      offline_captured: isOffline,
      synced_at: isOffline ? undefined : now,
    };

    const created = await base44.entities.Punch.create(punchData);
    setLastPunch(created);
    toast.success(`${punchType.replace('_', ' ')} recorded!`);
  }

  function handleOogConfirm(reason, note) {
    setOogOpen(false);
    handlePunch(pendingPunchType, reason, note);
  }

  const nextPunch = getPunchSequence();
  const punchConfig = {
    clock_in: { icon: LogIn, label: 'Clock In', color: 'bg-success hover:bg-success/90 text-success-foreground' },
    break_start: { icon: Coffee, label: 'Start Break', color: 'bg-warning hover:bg-warning/90 text-warning-foreground' },
    break_end: { icon: Play, label: 'End Break', color: 'bg-info hover:bg-info/90 text-info-foreground' },
    clock_out: { icon: LogOut, label: 'Clock Out', color: 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' },
  };
  const punch = punchConfig[nextPunch];
  const PunchIcon = punch.icon;

  return (
    <div className="flex flex-col items-center pt-8 space-y-8 animate-slide-up">
      {/* Time Display */}
      <div className="text-center">
        <p className="text-5xl font-bold font-display tracking-tight tabular-nums">
          {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          {currentTime.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* GPS Status */}
      <GpsChip status={gpsStatus} />

      {/* Site Selector */}
      <div className="w-full max-w-xs">
        <Select value={selectedSite} onValueChange={setSelectedSite}>
          <SelectTrigger>
            <SelectValue placeholder="Select site..." />
          </SelectTrigger>
          <SelectContent>
            {sites.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Punch Button */}
      <button
        onClick={() => handlePunch(nextPunch)}
        className={`relative w-40 h-40 rounded-full ${punch.color} flex flex-col items-center justify-center shadow-lg active:scale-95 transition-all duration-150`}
      >
        <div className="absolute inset-0 rounded-full animate-pulse-ring opacity-20" style={{ backgroundColor: 'currentColor' }} />
        <PunchIcon className="w-10 h-10 mb-2" />
        <span className="text-sm font-bold">{punch.label}</span>
      </button>

      {/* Last Punch Info */}
      {lastPunch && (
        <div className="text-center text-sm text-muted-foreground">
          <p>Last: <span className="font-medium capitalize">{lastPunch.punch_type?.replace('_', ' ')}</span></p>
          <p className="text-xs">{lastPunch.timestamp ? new Date(lastPunch.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''} · {lastPunch.site_name || 'No site'}</p>
        </div>
      )}

      <OutOfGeofenceModal open={oogOpen} onClose={() => setOogOpen(false)} onConfirm={handleOogConfirm} />
    </div>
  );
}