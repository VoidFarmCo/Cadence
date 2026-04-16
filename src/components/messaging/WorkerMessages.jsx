import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, MessageCircle, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

const categoryColors = {
  announcement: 'bg-info/10 text-info',
  schedule_change: 'bg-accent/10 text-accent',
  urgent: 'bg-destructive/10 text-destructive',
  general: 'bg-muted text-muted-foreground'
};

const categoryIcons = {
  announcement: Bell,
  schedule_change: MessageCircle,
  urgent: Bell,
  general: MessageCircle
};

export default function WorkerMessages() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    let unsubscribe;
    async function load() {
      const me = await base44.auth.me();
      setUser(me);

      const msgs = await base44.entities.Message.filter({
        recipient_emails: me.email
      }, '-created_date', 20);
      setMessages(msgs);
      setLoading(false);

      // Subscribe to new messages
      unsubscribe = base44.entities.Message.subscribe((event) => {
        if (event.type === 'create' && event.data.recipient_emails?.includes(me.email)) {
          setMessages(prev => [event.data, ...prev]);
        }
      });
    }

    load();
    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  async function handleMarkRead(message) {
    if (!message.is_read) {
      const readBy = [...(message.read_by || []), user.email];
      await base44.entities.Message.update(message.id, {
        is_read: true,
        read_by: readBy
      });
      setMessages(prev => prev.map(m => 
        m.id === message.id ? {...m, is_read: true, read_by: readBy} : m
      ));
    }
  }

  if (loading) {
    return <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" /></div>;
  }

  if (messages.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
          No messages yet
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Bell className="w-4 h-4 text-primary" />
        Messages ({messages.filter(m => !m.is_read).length} unread)
      </h3>
      {messages.map(msg => {
        const Icon = categoryIcons[msg.category] || MessageCircle;
        return (
          <Card 
            key={msg.id} 
            className={`cursor-pointer transition-all hover:shadow-md ${!msg.is_read ? 'border-primary/50 bg-primary/5' : ''}`}
            onClick={() => handleMarkRead(msg)}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  <Icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-sm">{msg.subject}</h4>
                    <Badge variant="secondary" className={`text-xs ${categoryColors[msg.category] || ''}`}>
                      {msg.category.replace('_', ' ')}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{msg.content}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>From: {msg.sender_name}</span>
                    <span>{format(new Date(msg.created_date), 'MMM d, h:mm a')}</span>
                  </div>
                </div>
                {msg.is_read && (
                  <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-1" />
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}