import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Eye, EyeOff, TrendingUp, Send, Download, Globe, Bitcoin, ArrowUpFromLine } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Wallet {
  id: string;
  currency: string;
  balance: number;
  wallet_number: string;
  type: string;
}

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [showBalance, setShowBalance] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchWallets = async () => {
      const { data } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user.id);
      setWallets(data || []);
      setLoading(false);
    };
    fetchWallets();
  }, [user]);

  const totalBalanceUsd = wallets.reduce((acc, w) => {
    // Simplified: just show raw balances aggregated
    if (w.currency === 'USD' || w.currency === 'USDT') return acc + Number(w.balance);
    if (w.currency === 'KES') return acc + Number(w.balance) * 0.0069;
    if (w.currency === 'EUR') return acc + Number(w.balance) * 1.09;
    if (w.currency === 'BTC') return acc + Number(w.balance) * 67000;
    if (w.currency === 'ETH') return acc + Number(w.balance) * 3450;
    return acc + Number(w.balance);
  }, 0);

  const formatCurrency = (amount: number, currency: string) => {
    const symbols: Record<string, string> = {
      KES: 'KSh', USD: '$', EUR: '€', BTC: '₿', ETH: 'Ξ', USDT: '$',
    };
    const prefix = symbols[currency] || '';
    return `${prefix}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const actions = [
    { icon: Send, label: 'Send Money', path: '/send', bg: 'bg-secondary' },
    { icon: ArrowUpFromLine, label: 'Withdraw', path: '/withdraw', bg: 'bg-secondary' },
    { icon: Download, label: 'Fund Wallet', path: '/wallets', bg: 'bg-secondary' },
    { icon: Globe, label: 'Exchange', path: '/exchange', bg: 'bg-secondary' },
    { icon: Bitcoin, label: 'Crypto', path: '/crypto', bg: 'bg-secondary' },
  ];

  return (
    <div className="space-y-6">
      {/* Balance Card */}
      <div className="balance-card-gradient rounded-2xl p-6 text-card space-y-4">
        <div className="flex justify-between items-start">
          <p className="text-sm opacity-80 text-primary-foreground">Total Balance</p>
          <button onClick={() => setShowBalance(!showBalance)}>
            {showBalance ? (
              <Eye className="w-5 h-5 text-primary-foreground opacity-60" />
            ) : (
              <EyeOff className="w-5 h-5 text-primary-foreground opacity-60" />
            )}
          </button>
        </div>
        <p className="text-3xl font-bold text-primary-foreground">
          {showBalance ? `$${totalBalanceUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '••••••••'}
        </p>
        <div className="flex items-center gap-1">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span className="text-sm text-primary">+0.0% this month</span>
        </div>

        {wallets.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {wallets.filter(w => w.type === 'fiat').map((w) => (
              <div key={w.id} className="bg-primary-foreground/10 rounded-lg px-3 py-2">
                <p className="text-xs opacity-70 text-primary-foreground">{w.currency}</p>
                <p className="text-sm font-semibold text-primary-foreground">
                  {showBalance ? formatCurrency(Number(w.balance), w.currency) : '••••'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={() => navigate(action.path)}
            className="flex flex-col items-center gap-3 p-5 rounded-xl border border-border bg-card hover:shadow-md transition-shadow"
          >
            <div className={`w-12 h-12 rounded-full ${action.bg} flex items-center justify-center`}>
              <action.icon className="w-5 h-5 text-primary" />
            </div>
            <span className="text-sm font-medium text-foreground">{action.label}</span>
          </button>
        ))}
      </div>

      {wallets.length === 0 && !loading && (
        <div className="text-center py-8 space-y-3">
          <p className="text-muted-foreground">No wallets yet</p>
          <button
            onClick={() => navigate('/wallets')}
            className="text-primary font-medium text-sm hover:underline"
          >
            Create your first wallet →
          </button>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
