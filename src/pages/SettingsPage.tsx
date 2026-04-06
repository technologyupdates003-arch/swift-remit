import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Settings as SettingsIcon, User, Lock } from 'lucide-react';

const SettingsPage = () => {
  const { user, setUser } = useAuth();
  const { toast } = useToast();
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [saving, setSaving] = useState(false);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('users').update({ full_name: fullName }).eq('id', user.id);
    setSaving(false);
    if (error) {
      toast({ title: 'Failed to update profile', variant: 'destructive' });
    } else {
      const updated = { ...user, full_name: fullName };
      setUser(updated);
      localStorage.setItem('abanremit_user', JSON.stringify(updated));
      toast({ title: 'Profile updated' });
    }
  };

  const savePin = async () => {
    if (newPin.length < 4) {
      toast({ title: 'PIN must be at least 4 digits', variant: 'destructive' });
      return;
    }
    if (newPin !== confirmPin) {
      toast({ title: 'PINs do not match', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.functions.invoke('set-pin', {
      body: { user_id: user?.id, pin: newPin },
    });
    setSaving(false);
    if (error || !data?.success) {
      toast({ title: data?.message || 'Failed to set PIN', variant: 'destructive' });
    } else {
      toast({ title: 'PIN set successfully' });
      setNewPin('');
      setConfirmPin('');
    }
  };

  return (
    <div className="space-y-6 max-w-md mx-auto">
      <div className="flex items-center gap-3">
        <SettingsIcon className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
      </div>

      <div className="border border-border rounded-xl p-5 bg-card space-y-4">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-primary" />
          <p className="font-medium text-foreground">Profile</p>
        </div>
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Full Name</label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <p className="text-sm text-muted-foreground">Phone: {user?.phone}</p>
        <Button onClick={saveProfile} disabled={saving}>Save Profile</Button>
      </div>

      <div className="border border-border rounded-xl p-5 bg-card space-y-4">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-primary" />
          <p className="font-medium text-foreground">Transaction PIN</p>
        </div>
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">New PIN</label>
          <Input type="password" maxLength={4} value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))} placeholder="••••" />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Confirm PIN</label>
          <Input type="password" maxLength={4} value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))} placeholder="••••" />
        </div>
        <Button onClick={savePin} disabled={saving}>Set PIN</Button>
      </div>
    </div>
  );
};

export default SettingsPage;
