import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { format, addDays, subDays, startOfWeek, parseISO, isSameDay } from 'date-fns';
import { toast } from 'sonner';

export default function SchedulePage() {
  const [shifts, setShifts] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [sites, setSites] = useState([]);
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState({ worker_email: '', site_id: '', date: '', start_time: '07:00', end_time: '15:00', notes: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.WorkerProfile.filter({ status: 'active' }),
      base44.entities.Site.filter({ status: 'active' }),
    ]).then(([w, s]) => { setWorkers(w); setSites(s); setLoading(false); });
    loadShifts();
  }, []);

  async function loadShifts() {
    const all = await base44.entities.Shift.list('date', 200);
    setShifts(all);
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  async function handleAdd() {
    try {
      const worker = workers.find(w => w.user_email === draft.worker_email);
      const site = sites.find(s => s.id === draft.site_id);
      await base44.entities.Shift.create({
        ...draft,
        worker_name: worker?.full_name || draft.worker_email,
        site_name: site?.name || '',
        status: 'scheduled',
      });
      toast.success('Shift added');
      setShowAdd(false);
      setDraft({ worker_email: '', site_id: '', date: '', start_time: '07:00', end_time: '15:00', notes: '' });
      loadShifts();
    } catch (err) {
      toast.error('Failed to add shift');
    }
  }

  async function deleteShift(id) {
    try {
      await base44.entities.Shift.delete(id);
      setShifts(s => s.filter(x => x.id !== id));
    } catch (err) {
      toast.error('Failed to delete shift');
    }
  }

  const statusColor = { scheduled: 'bg-info/10 text-info', confirmed: 'bg-success/10 text-success', cancelled: 'bg-muted text-muted-foreground' };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display tracking-tight">Schedule</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage weekly shift assignments</p>
        </div>
        <Button onClick={() => { setDraft({ worker_email: '', site_id: '', date: '', start_time: '07:00', end_time: '15:00', notes: '' }); setShowAdd(true); }}><Plus className="w-4 h-4" /> Add Shift</Button>
      </div>

      {/* Week nav */}
      <div className="flex items-center justify-between bg-card rounded-xl border border-border p-3">
        <Button variant="ghost" size="icon" onClick={() => setWeekStart(subDays(weekStart, 7))}><ChevronLeft className="w-5 h-5" /></Button>
        <p className="text-sm font-medium">{format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}</p>
        <Button variant="ghost" size="icon" onClick={() => setWeekStart(addDays(weekStart, 7))}><ChevronRight className="w-5 h-5" /></Button>
      </div>

      {/* Weekly grid */}
      <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
        {weekDays.map(day => {
          const dayShifts = shifts.filter(s => s.date && isSameDay(parseISO(s.date), day) && s.status !== 'cancelled');
          const isToday = isSameDay(day, new Date());
          return (
            <div key={day.toISOString()} className={`group bg-card rounded-xl border p-3 min-h-[120px] ${isToday ? 'border-primary/40' : 'border-border'}`}>
              <div className="flex items-center justify-between mb-2">
                <p className={`text-xs font-semibold ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                  {format(day, 'EEE')}<br /><span className={`text-base font-bold ${isToday ? 'text-primary' : 'text-foreground'}`}>{format(day, 'd')}</span>
                </p>
                <button
                  onClick={() => { setDraft({ worker_email: '', site_id: '', date: format(day, 'yyyy-MM-dd'), start_time: '07:00', end_time: '15:00', notes: '' }); setShowAdd(true); }}
                  className="opacity-0 group-hover:opacity-100 hover:opacity-100 focus:opacity-100 p-1 rounded-full hover:bg-primary/10 transition-opacity text-primary"
                  title={`Add shift on ${format(day, 'EEE MMM d')}`}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-1.5">
                {dayShifts.map(shift => (
                  <div key={shift.id} className="group relative bg-primary/5 border border-primary/10 rounded-lg p-2">
                    <p className="text-[11px] font-semibold text-foreground truncate">{shift.worker_name}</p>
                    <p className="text-[10px] text-muted-foreground">{shift.start_time}–{shift.end_time}</p>
                    {shift.site_name && <p className="text-[10px] text-muted-foreground truncate">{shift.site_name}</p>}
                    <button
                      onClick={() => deleteShift(shift.id)}
                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/10"
                    >
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Shift Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Shift</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Worker</Label>
              <Select value={draft.worker_email} onValueChange={v => setDraft(d => ({ ...d, worker_email: v }))}>
                <SelectTrigger><SelectValue placeholder="Select worker…" /></SelectTrigger>
                <SelectContent>{workers.map(w => <SelectItem key={w.user_email} value={w.user_email}>{w.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <div className="grid grid-cols-7 gap-1">
                {weekDays.map(day => {
                  const val = format(day, 'yyyy-MM-dd');
                  const isSelected = draft.date === val;
                  const isToday = isSameDay(day, new Date());
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setDraft(d => ({ ...d, date: val }))}
                      className={`flex flex-col items-center rounded-lg p-1.5 text-xs font-medium transition-colors border
                        ${isSelected ? 'bg-primary text-primary-foreground border-primary' : isToday ? 'border-primary/40 text-primary bg-primary/5 hover:bg-primary/10' : 'border-border hover:bg-muted text-foreground'}`}
                    >
                      <span className="text-[10px] text-inherit opacity-70">{format(day, 'EEE')}</span>
                      <span className="text-sm font-bold">{format(day, 'd')}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Time</Label>
                <Input type="time" value={draft.start_time} onChange={e => setDraft(d => ({ ...d, start_time: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>End Time</Label>
                <Input type="time" value={draft.end_time} onChange={e => setDraft(d => ({ ...d, end_time: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Site (optional)</Label>
              <Select value={draft.site_id} onValueChange={v => setDraft(d => ({ ...d, site_id: v === '__none__' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Select site…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No site</SelectItem>
                  {sites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Input placeholder="Any instructions…" value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button disabled={!draft.worker_email || !draft.date} onClick={handleAdd}>Add Shift</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}