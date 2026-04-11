import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield, Mail, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const AdminLoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: 'Please fill in all fields', variant: 'destructive' });
      return;
    }
    setLoading(true);

    const result = await signIn(email, password);
    if (!result.success) {
      toast({ title: result.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    // Verify admin role via server-side function
    const { data: userId } = await supabase.rpc('get_user_id_from_auth');
    if (!userId) {
      await supabase.auth.signOut();
      toast({ title: 'Access denied', description: 'User profile not found', variant: 'destructive' });
      setLoading(false);
      return;
    }
    const { data: hasAdmin } = await supabase.rpc('has_role', {
      _user_id: userId,
      _role: 'admin',
    });

    if (!hasAdmin) {
      await supabase.auth.signOut();
      toast({ title: 'Access denied', description: 'You do not have admin privileges', variant: 'destructive' });
      setLoading(false);
      return;
    }

    setLoading(false);
    navigate('/admin');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-destructive flex items-center justify-center mx-auto">
            <Shield className="w-8 h-8 text-destructive-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Admin Portal</h1>
          <p className="text-muted-foreground text-sm">Restricted access — authorized personnel only</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Admin Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="admin@abanremit.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full" variant="destructive">
            {loading ? 'Verifying...' : 'Access Admin Panel'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          <Link to="/login" className="text-primary font-medium hover:underline">
            ← Back to User Login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default AdminLoginPage;
