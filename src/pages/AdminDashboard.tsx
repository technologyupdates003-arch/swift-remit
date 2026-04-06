import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Users, Wallet, ArrowRightLeft, Shield } from 'lucide-react';

const AdminDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState({ users: 0, wallets: 0, transactions: 0 });
  const [wallets, setWallets] = useState<any[]>([]);
  const [kycDocs, setKycDocs] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [tab, setTab] = useState<'overview' | 'wallets' | 'transactions' | 'kyc'>('overview');

  useEffect(() => {
    // Admin queries use the admin RLS policies
    const fetchData = async () => {
      const [usersRes, walletsRes, txRes, kycRes] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('wallets').select('*'),
        supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('kyc_documents').select('*').order('created_at', { ascending: false }),
      ]);
      setStats({
        users: usersRes.count || 0,
        wallets: walletsRes.data?.length || 0,
        transactions: txRes.data?.length || 0,
      });
      setWallets(walletsRes.data || []);
      setTransactions(txRes.data || []);
      setKycDocs(kycRes.data || []);
    };
    fetchData();
  }, []);

  const updateKyc = async (id: string, status: 'approved' | 'rejected') => {
    const { error } = await supabase.from('kyc_documents').update({ status }).eq('id', id);
    if (error) {
      toast({ title: 'Update failed', variant: 'destructive' });
    } else {
      toast({ title: `KYC ${status}` });
      setKycDocs(prev => prev.map(d => d.id === id ? { ...d, status } : d));
    }
  };

  const tabs = [
    { key: 'overview', label: 'Overview', icon: Users },
    { key: 'wallets', label: 'Wallets', icon: Wallet },
    { key: 'transactions', label: 'Transactions', icon: ArrowRightLeft },
    { key: 'kyc', label: 'KYC', icon: Shield },
  ] as const;

  // Aggregate balances by currency
  const balanceByCurrency: Record<string, number> = {};
  wallets.forEach(w => {
    balanceByCurrency[w.currency] = (balanceByCurrency[w.currency] || 0) + Number(w.balance);
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>

      <div className="flex gap-2 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
              tab === t.key ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground border border-border'
            }`}
          >
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-card border border-border text-center">
              <p className="text-2xl font-bold text-foreground">{stats.users}</p>
              <p className="text-xs text-muted-foreground">Users</p>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border text-center">
              <p className="text-2xl font-bold text-foreground">{stats.wallets}</p>
              <p className="text-xs text-muted-foreground">Wallets</p>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border text-center">
              <p className="text-2xl font-bold text-foreground">{stats.transactions}</p>
              <p className="text-xs text-muted-foreground">Transactions</p>
            </div>
          </div>
          <div className="border border-border rounded-xl p-5 bg-card">
            <p className="font-medium text-foreground mb-3">System Totals</p>
            {Object.entries(balanceByCurrency).map(([cur, bal]) => (
              <div key={cur} className="flex justify-between py-1 text-sm">
                <span className="text-muted-foreground">{cur}</span>
                <span className="font-medium text-foreground">{Number(bal).toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'wallets' && (
        <div className="space-y-2">
          {wallets.map(w => (
            <div key={w.id} className="flex items-center justify-between p-4 rounded-xl bg-card border border-border">
              <div>
                <p className="text-sm font-medium text-foreground">{w.wallet_number}</p>
                <p className="text-xs text-muted-foreground">User: {w.user_id.slice(0, 8)}...</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-foreground">{w.currency} {Number(w.balance).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{w.status}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'transactions' && (
        <div className="space-y-2">
          {transactions.map(tx => (
            <div key={tx.id} className="p-4 rounded-xl bg-card border border-border">
              <div className="flex justify-between">
                <span className="text-sm font-medium capitalize text-foreground">{tx.type}</span>
                <span className="text-sm font-bold text-foreground">{tx.currency} {Number(tx.amount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-muted-foreground">{tx.reference.slice(0, 16)}...</span>
                <span className={`text-xs ${tx.status === 'completed' ? 'text-primary' : 'text-muted-foreground'}`}>{tx.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'kyc' && (
        <div className="space-y-3">
          {kycDocs.map(doc => (
            <div key={doc.id} className="p-4 rounded-xl bg-card border border-border space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium capitalize text-foreground">{doc.document_type.replace('_', ' ')}</span>
                <span className={`text-xs font-medium ${doc.status === 'approved' ? 'text-primary' : doc.status === 'rejected' ? 'text-destructive' : 'text-warning'}`}>
                  {doc.status}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">User: {doc.user_id.slice(0, 8)}...</p>
              {doc.status === 'pending' && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => updateKyc(doc.id, 'approved')}>Approve</Button>
                  <Button size="sm" variant="destructive" onClick={() => updateKyc(doc.id, 'rejected')}>Reject</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
