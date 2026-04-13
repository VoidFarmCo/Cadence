import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export default function NotificationBell({ user, isAdmin }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    if (!user) return;
    loadNotifications();
  }, [user]);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function loadNotifications() {
    const notes = [];
    if (isAdmin) {
      // For admins: recent pending leave requests + tax forms
      const [leaves, forms] = await Promise.all([
        base44.entities.LeaveRequest.filter({ status: 'pending' }, '-created_date', 5),
        base44.entities.TaxForm.filter({ status: 'pending' }, '-created_date', 5),
      ]);
      leaves.forEach(l => notes.push({
        id: `leave-${l.id}`, type: 'leave',
        text: `${l.worker_name || l.worker_email} requested ${l.leave_type} leave`,
        time: l.created_date, color: 'text-warning'
      }));
      forms.forEach(f => notes.push({
        id: `form-${f.id}`, type: 'form',
        text: `${f.worker_name || f.worker_email} has pending ${f.form_type}`,
        time: f.created_date, color: 'text-info'
      }));
    } else {
      // For workers: pending forms + recent approved/denied leave
      const [forms, leaves] = await Promise.all([
        base44.entities.TaxForm.filter({ worker_email: user.email, status: 'pending' }, '-created_date', 5),
        base44.entities.LeaveRequest.filter({ worker_email: user.email }, '-created_date', 5),
      ]);
      forms.forEach(f => notes.push({
        id: `form-${f.id}`, type: 'form',
        text: `New form to complete: ${f.form_type}${f.due_date ? ` (due ${f.due_date})` : ''}`,
        time: f.sent_at || f.created_date, color: 'text-warning'
      }));
      leaves.filter(l => l.status !== 'pending').forEach(l => notes.push({
        id: `leave-${l.id}`, type: 'leave',
        text: `Leave request ${l.status}: ${l.leave_type} ${l.start_date}`,
        time: l.reviewed_at || l.created_date,
        color: l.status === 'approved' ? 'text-success' : 'text-destructive'
      }));
    }
    notes.sort((a, b) => new Date(b.time) - new Date(a.time));
    setItems(notes.slice(0, 8));
    setUnread(notes.length);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(o => !o); setUnread(0); }}
        className="relative p-1.5 rounded-lg hover:bg-muted/50 transition-colors"
      >
        <Bell className="w-4 h-4 text-muted-foreground" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-9 w-80 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold text-foreground">Notifications</p>
          </div>
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">All caught up!</p>
          ) : (
            <div className="max-h-72 overflow-y-auto divide-y divide-border">
              {items.map(item => (
                <div key={item.id} className="px-4 py-3">
                  <p className={cn("text-xs font-medium", item.color)}>{item.text}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {item.time ? format(new Date(item.time), 'MMM d, h:mm a') : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}