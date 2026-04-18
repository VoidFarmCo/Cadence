import { useState, useEffect, useCallback } from 'react';
import api from '@/api/apiClient';
import { Sites, WorkerProfiles, Punches, TimeEntries } from '@/api/entities';
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
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function init() {
      const me = await api.get('/api/auth/me').then(r => r.data);
      setUser(me);
      const [s, profiles, punches] = await Promise.all([
        Sites.list({ status: 'active' }),
        WorkerProfiles.list({ user_email: me.email }),
        Punches.list({ worker_email: me.email, sort: '-created_date', limit: 1 }),
      ]);
      setSites(s);
      const p = profiles[0];
      setProfile(p);
      if (p?.default_site_id) setSelectedSite(p.default_site_id);
      else if (s.length > 0) setSelectedSite(s[0].id);
      if (punches.length > 0) setLastPunch(punches[0]);
    }
    init().catch((err) => {
      console.error('Failed to load clock page data:', err);
      toast.error('Failed to load your clock data. Please refresh.');
    });
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

    // Optimistic update: immediately reflect the punch in UI
    const previousPunch = lastPunch;
    setLastPunch({ ...punchData, id: `temp-${now}` });
    setSubmitting(true);
    try {
    const created = await Punches.create(punchData);
    setLastPunch(created);

    // On clock-in: create or update a TimeEntry for today
    if (punchType === 'clock_in') {
      const today = new Date().toISOString().split('T')[0];
      const existing = await TimeEntries.list({ worker_email: user.email, date: today });
      const entryData = {
        clock_in: now,
        site_id: selectedSite || undefined,
        site_name: site?.name || undefined,
        ...(position?.latitude && { clock_in_latitude: position.latitude }),
        ...(position?.longitude && { clock_in_longitude: position.longitude }),
      };
      if (existing.length > 0) {
        await TimeEntries.update(existing[0].id, entryData);
      } else {
        await TimeEntries.create({
          worker_email: user.email,
          worker_name: user.full_name || profile?.full_name || user.email,
          date: today,
          status: 'pending',
          ...entryData,
        });
      }
    }

    // On break_start: record break start time in exception_notes for later calculation
    if (punchType === 'break_start') {
      const today = new Date().toISOString().split('T')[0];
      const existing = await TimeEntries.list({ worker_email: user.email, date: today });
      if (existing.length > 0) {
        const entry = existing[0];
        let meta = {};
        try {
          meta = JSON.parse(entry.exception_notes || '{}');
        } catch (err) {
          console.warn('Malformed exception_notes, resetting:', err);
        }
        // Store break start time so break_end can calculate duration
        await TimeEntries.update(entry.id, {
          exception_notes: JSON.stringify({ ...meta, break_start: now }),
        });
      }
    }

    // On break_end: calculate break duration and accumulate break_minutes
    if (punchType === 'break_end') {
      const today = new Date().toISOString().split('T')[0];
      const existing = await TimeEntries.list({ worker_email: user.email, date: today });
      if (existing.length > 0) {
        const entry = existing[0];
        let meta = {};
        try {
          meta = JSON.parse(entry.exception_notes || '{}');
        } catch (err) {
          console.warn('Malformed exception_notes, resetting:', err);
        }
        if (meta.break_start) {
          const extraBreakMinutes = Math.round((new Date(now) - new Date(meta.break_start)) / 60000);
          delete meta.break_start;
          await TimeEntries.update(entry.id, {
            break_minutes: (entry.break_minutes || 0) + extraBreakMinutes,
            exception_notes: JSON.stringify(meta),
          });
        }
      }
    }

    // On clock-out: update TimeEntry with clock_out and total_hours
    if (punchType === 'clock_out') {
      const today = new Date().toISOString().split('T')[0];
      const existing = await TimeEntries.list({ worker_email: user.email, date: today });
      if (existing.length > 0) {
        const entry = existing[0];
        let totalHours = 0;
        if (entry.clock_in) {
          const diffMs = new Date(now) - new Date(entry.clock_in);
          const diffHours = diffMs / (1000 * 60 * 60);
          const breakHours = (entry.break_minutes || 0) / 60;
          totalHours = Math.max(0, diffHours - breakHours);
        }
        // Calculate weekly hours to determine OT correctly (weekly threshold, default 40hrs)
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday
        weekStart.setHours(0, 0, 0, 0);
        const weekEntries = await TimeEntries.list({ worker_email: user.email });
        const hoursThisWeekSoFar = weekEntries
          .filter(e => e.id !== entry.id && e.date >= weekStart.toISOString().split('T')[0])
          .reduce((s, e) => s + (e.total_hours || 0), 0);
        const weeklyOTThreshold = 40;
        const remainingRegular = Math.max(0, weeklyOTThreshold - hoursThisWeekSoFar);
        const regularHours = Math.min(totalHours, remainingRegular);
        const overtimeHours = Math.max(0, totalHours - regularHours);
        await TimeEntries.update(entry.id, {
          clock_out: now,
          total_hours: parseFloat(totalHours.toFixed(2)),
          regular_hours: parseFloat(regularHours.toFixed(2)),
          overtime_hours: parseFloat(overtimeHours.toFixed(2)),
          has_exception: entry.has_exception || false,
        });
      }
    }

    toast.success(`${punchType.replace('_', ' ')} recorded!`);
    } catch (err) {
      // Roll back optimistic update and notify the user
      setLastPunch(previousPunch);
      console.error('Failed to record punch:', err);
      toast.error(err?.response?.data?.error || 'Failed to record punch. Please try again.');
    } finally {
      setSubmitting(false);
    }
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
        onClick={() => !submitting && handlePunch(nextPunch)}
        disabled={submitting}
        className={`relative w-40 h-40 rounded-full ${punch.color} flex flex-col items-center justify-center shadow-lg active:scale-95 transition-all duration-150 disabled:opacity-70`}
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
