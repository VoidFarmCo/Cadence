import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Send, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function DirectMessage({ workers }) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ worker_email: '', subject: '', content: '', category: 'general' });

  async function handleSend() {
    if (!form.worker_email || !form.subject || !form.content) {
      toast.error('Worker, subject, and content are required');
      return;
    }
    setSending(true);
    const me = await base44.auth.me();
    await base44.entities.Message.create({
      type: 'direct',
      sender_email: me.email,
      sender_name: me.full_name,
      subject: form.subject,
      content: form.content,
      category: form.category,
      recipient_emails: [form.worker_email]
    });
    toast.success('Message sent');
    setOpen(false);
    setForm({ worker_email: '', subject: '', content: '', category: 'general' });
    setSending(false);
  }

  const selectedWorker = workers.find(w => w.user_email === form.worker_email);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <MessageCircle className="w-4 h-4" />
          Direct Message
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Direct Message to Worker</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Worker</Label>
            <Select value={form.worker_email} onValueChange={v => setForm({...form, worker_email: v})}>
              <SelectTrigger>
                <SelectValue placeholder="Select worker..." />
              </SelectTrigger>
              <SelectContent>
                {workers.map(w => (
                  <SelectItem key={w.user_email} value={w.user_email}>
                    {w.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Subject</Label>
            <Input 
              value={form.subject} 
              onChange={e => setForm({...form, subject: e.target.value})}
              placeholder="e.g., Schedule Change This Friday"
            />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
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
              placeholder="Type your message..."
              className="h-20"
            />
          </div>
          <Button 
            onClick={handleSend} 
            disabled={sending || !selectedWorker} 
            className="w-full gap-2"
          >
            <Send className="w-4 h-4" />
            {sending ? 'Sending...' : 'Send Message'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}