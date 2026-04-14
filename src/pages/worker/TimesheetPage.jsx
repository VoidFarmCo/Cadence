import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Send, MapPin } from 'lucide-react';
import { formatHours, formatTime, formatDate, getWeekRange } from '@/lib/timeUtils';
import { format, addDays, subDays, startOfWeek, parseISO, isSameDay } from 'date-fns';
import { toast } from 'sonner';

export default function TimesheetPage() {
  const [entries, setEntries] = useState([]);
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    async function load() {
      const me = await base44.auth.me();
      setUser(me);
      const allEntries = await base44.entities.TimeEntry.filter({ worker_email: me.email }, '-date', 50);
      setEntries(allEntries);
      setLoading(false);
    }
    load();
  }, []);

  const weekEnd = addDays(weekStart, 6);
  const daysOfWeek = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const weekEntries = entries.filter(e => {
    if (!e.date) return false;
    const d = parseISO(e.date);
    return d >= weekStart && d <= weekEnd;
  });

  const totalHours = weekEntries.reduce((s, e) => s + (e.total_hours || 0), 0);
  const totalOT = weekEntries.reduce((s, e) => s + (e.overtime_hours || 0), 0);

  const canSubmit = weekEntries.length > 0 && weekEntries.every(e => e.status === 'pending');

  async function handleSubmit() {
    for (const entry of weekEntries) {
      if (entry.status === 'pending') {
        await base44.entities.TimeEntry.update(entry.id, { status: 'submitted' });
      }
    }
    setEntries(prev => prev.map(e => {
      const d = parseISO(e.date);
      if (d >= weekStart && d <= weekEnd && e.status === 'pending') {
        return { ...e, status: 'submitted' };
      }
      return e;
    }));
    toast.success('Timesheet submitted for approval');
  }

  const statusColors = {
    pending: 'bg-muted text-muted-foreground',
    submitted: 'bg-info/10 text-info',
    approved: 'bg-success/10 text-success',
    rejected: 'bg-destructive/10 text-destructive',
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold font-display">Timesheet</h1>
        {canSubmit && (
          <Button size="sm" onClick={handleSubmit} className="gap-2">
            <Send className="w-4 h-4" />Submit
          </Button>
        )}
      </div>

      {/* Week Selector */}
      <div className="flex items-center justify-between bg-card rounded-xl border border-border p-3">
        <Button variant="ghost" size="icon" onClick={() => setWeekStart(subDays(weekStart, 7))}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <p className="text-sm font-medium">
          {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
        </p>
        <Button variant="ghost" size="icon" onClick={() => setWeekStart(addDays(weekStart, 7))}>
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-xs text-muted-foreground">Total Hours</p>
          <p className="text-2xl font-bold font-display mt-1">{formatHours(totalHours)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-xs text-muted-foreground">Overtime</p>
          <p className="text-2xl font-bold font-display mt-1 text-warning">{formatHours(totalOT)}</p>
        </div>
      </div>

      {/* Daily entries */}
      <div className="space-y-2">
        {daysOfWeek.map(day => {
          const dayEntries = weekEntries.filter(e => isSameDay(parseISO(e.date), day));
          const isToday = isSameDay(day, new Date());
          const dayTotal = dayEntries.reduce((s, e) => s + (e.total_hours || 0), 0);

          return (
            <div
              key={day.toISOString()}
              className={`bg-card rounded-xl border ${isToday ? 'border-primary/30 shadow-sm' : 'border-border'} p-4`}
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className={`text-sm font-semibold ${isToday ? 'text-primary' : ''}`}>
                    {format(day, 'EEEE')}
                  </p>
                  <p className="text-xs text-muted-foreground">{format(day, 'MMM d')}</p>
                </div>
                <p className="text-sm font-bold">{dayTotal > 0 ? formatHours(dayTotal) : '—'}</p>
              </div>
              {dayEntries.map(entry => (
                <div key={entry.id} className="py-1.5 border-t border-border mt-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      {formatTime(entry.clock_in)} – {formatTime(entry.clock_out)}
                      {entry.break_minutes > 0 && <span className="ml-2">({entry.break_minutes}m break)</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {entry.has_exception && (
                        <Badge variant="outline" className="text-[9px] border-warning text-warning">Exception</Badge>
                      )}
                      <Badge variant="secondary" className={`text-[9px] capitalize ${statusColors[entry.status] || ''}`}>
                        {entry.status}
                      </Badge>
                    </div>
                  </div>
                  {entry.clock_in_latitude && entry.clock_in_longitude && (
                    <a
                      href={`https://www.google.com/maps?q=${entry.clock_in_latitude},${entry.clock_in_longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-1 text-[10px] text-primary hover:underline"
                    >
                      <MapPin className="w-3 h-3" />
                      Clock-in location: {entry.clock_in_latitude.toFixed(5)}, {entry.clock_in_longitude.toFixed(5)}
                    </a>
                  )}
                </div>
              ))}
              {dayEntries.length === 0 && (
                <p className="text-xs text-muted-foreground/50 mt-1">No entries</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}