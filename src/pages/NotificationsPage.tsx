import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Bell, Check } from 'lucide-react';

interface Notification {
  id: string;
  message: string;
  type: string;
  read_status: boolean;
  created_at: string;
}

const NotificationsPage = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from('notifications').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false }).then(({ data }) => {
        setNotifications(data || []);
        setLoading(false);
      });
  }, [user]);

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ read_status: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_status: true } : n));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
      {loading ? (
        <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}</div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-12">
          <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <div
              key={n.id}
              className={`p-4 rounded-xl border ${n.read_status ? 'bg-card border-border' : 'bg-secondary border-primary/20'}`}
              onClick={() => !n.read_status && markRead(n.id)}
            >
              <div className="flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full mt-2 ${n.read_status ? 'bg-muted' : 'bg-primary'}`} />
                <div className="flex-1">
                  <p className="text-sm text-foreground">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
