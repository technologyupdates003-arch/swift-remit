import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Users, Wallet, ArrowRightLeft, Shield, UserCheck } from 'lucide-react';

const AdminDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState({ users: 0, wallets: 0, transactions: 0, pendingKyc: 0 });
  const [wallets, setWallets] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [kycDocs, setKycDocs] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [tab, setTab] = useState<'overview' | 'users' | 'wallets' | 'transactions' | 'kyc'>('overview');

  useEffect(() => {
    const fetchData = async () => {
      const [usersRes, walletsRes, txRes, kycRes] = await Promise.all([
        supabase.from('users').select('*'),
        supabase.from('wallets').select('*'),
        supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('kyc_documents').select('*').order('created_at', { ascending: false }),
      ]);
      const usersData = usersRes.data || [];
      const kycData = kycRes.data || [];
      setAllUsers(usersData);
      setStats({
        users: usersData.length,
        wallets: walletsRes.data?.length || 0,
        transactions: txRes.data?.length || 0,
        pendingKyc: kycData.filter((d: any) => d.status === 'pending').length,
      });
      setWallets(walletsRes.data || []);
      setTransactions(txRes.data || []);
      setKycDocs(kycData);
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
      if (status === 'approved') setStats(s => ({ ...s, pendingKyc: s.pendingKyc - 1 }));
    }
  };

  const tabs = [
    { key: 'overview', label: 'Overview', icon: Users },
    { key: 'users', label: 'Users', icon: UserCheck },
    { key: 'wallets', label: 'Wallets', icon: Wallet },
    { key: 'transactions', label: 'Transactions', icon: ArrowRightLeft },
    { key: 'kyc', label: 'KYC', icon: Shield },
  ] as const;

  const balanceByCurrency: Record<string, number> = {};
  wallets.forEach(w => {
    balanceByCurrency[w.currency] = (balanceByCurrency[w.currency] || 0) + Number(w.balance);
  });

  const txByStatus: Record<string, number> = {};
  transactions.forEach(tx => {
    txByStatus[tx.status] = (txByStatus[tx.status] || 0) + 1;
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              tab === t.key ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground border border-border'
            }`}
          >
            <t.icon className="w-4 h-4" />{t.label}
            {t.key === 'kyc' && stats.pendingKyc > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-destructive text-destructive-foreground">{stats.pendingKyc}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Total Users', value: stats.users },
              { label: 'Total Wallets', value: stats.wallets },
              { label: 'Transactions', value: stats.transactions },
              { label: 'Pending KYC', value: stats.pendingKyc },
            ].map(s => (
              <div key={s.label} className="p-4 rounded-xl bg-card border border-border text-center">
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="border border-border rounded-xl p-5 bg-card">
            <p className="font-medium text-foreground mb-3">System Totals by Currency</p>
            {Object.keys(balanceByCurrency).length === 0 ? (
              <p className="text-sm text-muted-foreground">No wallets yet</p>
            ) : (
              Object.entries(balanceByCurrency).map(([cur, bal]) => (
                <div key={cur} className="flex justify-between py-1 text-sm">
                  <span className="text-muted-foreground">{cur}</span>
                  <span className="font-medium text-foreground">{Number(bal).toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
                </div>
              ))
            )}
          </div>

          <div className="border border-border rounded-xl p-5 bg-card">
            <p className="font-medium text-foreground mb-3">Transaction Status Breakdown</p>
            {Object.keys(txByStatus).length === 0 ? (
              <p className="text-sm text-muted-foreground">No transactions yet</p>
            ) : (
              Object.entries(txByStatus).map(([status, count]) => (
                <div key={status} className="flex justify-between py-1 text-sm">
                  <span className="text-muted-foreground capitalize">{status}</span>
                  <span className="font-medium text-foreground">{count}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="space-y-2">
          {allUsers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No users found</p>
          ) : allUsers.map(u => (
            <div key={u.id} className="p-4 rounded-xl bg-card border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{u.full_name || 'No name'}</p>
                  <p className="text-xs text-muted-foreground">{u.email || u.phone || 'No contact'}</p>
                </div>
                <div className="text-right">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    u.kyc_status === 'approved' ? 'bg-primary/20 text-primary' :
                    u.kyc_status === 'pending' ? 'bg-warning/20 text-warning' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    KYC: {u.kyc_status}
                  </span>
                </div>
              </div>
              <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                <span>PIN: {u.pin_hash ? '✓ Set' : '✗ Not set'}</span>
                <span>Admin: {u.is_admin ? 'Yes' : 'No'}</span>
                <span>Joined: {new Date(u.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'wallets' && (
        <div className="space-y-2">
          {wallets.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No wallets found</p>
          ) : wallets.map(w => (
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
          {transactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No transactions found</p>
          ) : transactions.map(tx => (
            <div key={tx.id} className="p-4 rounded-xl bg-card border border-border">
              <div className="flex justify-between">
                <span className="text-sm font-medium capitalize text-foreground">{tx.type}</span>
                <span className="text-sm font-bold text-foreground">{tx.currency} {Number(tx.amount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-muted-foreground">{tx.reference?.slice(0, 20)}...</span>
                <span className={`text-xs font-medium ${
                  tx.status === 'completed' ? 'text-primary' :
                  tx.status === 'pending' ? 'text-warning' :
                  tx.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'
                }`}>{tx.status}</span>
              </div>
              {tx.network && <p className="text-xs text-muted-foreground mt-1">{tx.network}</p>}
              <p className="text-xs text-muted-foreground mt-1">{new Date(tx.created_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'kyc' && (
        <div className="space-y-3">
          {kycDocs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No KYC submissions</p>
          ) : kycDocs.map(doc => (
            <div key={doc.id} className="p-4 rounded-xl bg-card border border-border space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium capitalize text-foreground">{doc.document_type.replace('_', ' ')}</span>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  doc.status === 'approved' ? 'bg-primary/20 text-primary' :
                  doc.status === 'rejected' ? 'bg-destructive/20 text-destructive' :
                  'bg-warning/20 text-warning'
                }`}>
                  {doc.status}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">User: {doc.user_id.slice(0, 8)}...</p>
              <p className="text-xs text-muted-foreground">{new Date(doc.created_at).toLocaleString()}</p>
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
