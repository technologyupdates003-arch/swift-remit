import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ArrowUpRight, ArrowDownLeft, RefreshCw, Download } from 'lucide-react';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  reference: string;
  created_at: string;
}

const TransactionsPage = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: userId } = await supabase.rpc('get_user_id_from_auth');
      if (userId) {
        const { data } = await supabase.from('transactions').select('*')
          .or(`user_id.eq.${userId},receiver_user_id.eq.${userId}`)
          .order('created_at', { ascending: false });
        setTransactions(data || []);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'deposit': return <ArrowDownLeft className="w-4 h-4 text-primary" />;
      case 'withdrawal': return <ArrowUpRight className="w-4 h-4 text-destructive" />;
      case 'transfer': return <ArrowUpRight className="w-4 h-4 text-foreground" />;
      case 'exchange': return <RefreshCw className="w-4 h-4 text-primary" />;
      default: return <Download className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Transactions</h1>
      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}</div>
      ) : transactions.length === 0 ? (
        <p className="text-center py-12 text-muted-foreground">No transactions yet</p>
      ) : (
        <div className="space-y-2">
          {transactions.map(tx => (
            <div key={tx.id} className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">{getIcon(tx.type)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium capitalize text-foreground">{tx.type}</p>
                <p className="text-xs text-muted-foreground truncate">{tx.reference}</p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-semibold ${tx.type === 'deposit' ? 'text-primary' : 'text-foreground'}`}>
                  {tx.type === 'deposit' ? '+' : '-'}{tx.currency} {Number(tx.amount).toLocaleString()}
                </p>
                <p className={`text-xs ${tx.status === 'completed' ? 'text-primary' : tx.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {tx.status}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TransactionsPage;
