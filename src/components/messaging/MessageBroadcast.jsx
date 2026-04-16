import { useState } from 'react';
import api from '@/api/apiClient';
import { Messages } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Send, Bell } from 'lucide-react';
import { toast } from 'sonner';

export default function MessageBroadcast({ workers }) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ subject: '', content: '', category: 'announcement' });

  async function handleBroadcast() {
    if (!form.subject || !form.content) {
      toast.error('Subject and content are required');
      return;
    }
    setSending(true);
    const me = await api.get('/api/auth/me').then(r => r.data);
    await Messages.create({
      type: 'broadcast',
      sender_email: me.email,
      sender_name: me.full_name,
      subject: form.subject,
      content: form.content,
      category: form.category,
      recipient_emails: workers.map(w => w.user_email)
    });
    toast.success('Announcement sent to all workers');
    setOpen(false);
    setForm({ subject: '', content: '', category: 'announcement' });
    setSending(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Bell className="w-4 h-4" />
          Broadcast Announcement
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Announcement to All Workers</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Subject</Label>
            <Input
              value={form.subject}
              onChange={e => setForm({...form, subject: e.target.value})}
              placeholder="e.g., Schedule Change Friday"
            />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="announcement">Announcement</SelectItem>
                <SelectItem value="schedule_change">Schedule Change</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              value={form.content}
              onChange={e => setForm({...form, content: e.target.value})}
              placeholder="Type your announcement..."
              className="h-24"
            />
          </div>
          <Button
            onClick={handleBroadcast}
            disabled={sending}
            className="w-full gap-2"
          >
            <Send className="w-4 h-4" />
            {sending ? 'Sending...' : 'Send to All'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
