import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Plus, Wallet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import PaystackPayment from '@/components/PaystackPayment';

interface Wallet {
  id: string;
  currency: string;
  balance: number;
  wallet_number: string;
  type: string;
  status: string;
  wallet_address: string | null;
  created_at: string;
}

const currencies = [
  { value: 'KES', label: 'KES - Kenyan Shilling', type: 'fiat' },
  { value: 'USD', label: 'USD - US Dollar', type: 'fiat' },
  { value: 'EUR', label: 'EUR - Euro', type: 'fiat' },
  { value: 'BTC', label: 'BTC - Bitcoin', type: 'crypto' },
  { value: 'ETH', label: 'ETH - Ethereum', type: 'crypto' },
  { value: 'USDT', label: 'USDT - Tether', type: 'crypto' },
];

const WalletsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);

  const fetchWallets = async () => {
    if (!user) return;
    const { data } = await supabase.from('wallets').select('*').eq('user_id', user.id).order('created_at', { ascending: true });
    setWallets(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchWallets(); }, [user]);

  const createWallet = async () => {
    if (!selectedCurrency || !user) return;
    const existing = wallets.find(w => w.currency === selectedCurrency);
    if (existing) {
      toast({ title: `You already have a ${selectedCurrency} wallet`, variant: 'destructive' });
      return;
    }
    setCreating(true);
    const currencyInfo = currencies.find(c => c.value === selectedCurrency);
    const walletNumber = `WLT-${selectedCurrency}-${Date.now()}`;
    const walletAddress = currencyInfo?.type === 'crypto' ? `0x${Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}` : null;

    const { error } = await supabase.from('wallets').insert({
      user_id: user.id,
      currency: selectedCurrency,
      wallet_number: walletNumber,
      type: currencyInfo?.type === 'crypto' ? 'crypto' : 'fiat',
      wallet_address: walletAddress,
    });

    setCreating(false);
    if (error) {
      toast({ title: 'Failed to create wallet', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `${selectedCurrency} wallet created!` });
      setDialogOpen(false);
      setSelectedCurrency('');
      fetchWallets();
    }
  };

  const formatBalance = (amount: number, currency: string) => {
    const symbols: Record<string, string> = { KES: 'KSh', USD: '$', EUR: '€', BTC: '₿', ETH: 'Ξ', USDT: '$' };
    return `${symbols[currency] || ''}${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: currency === 'BTC' ? 6 : 2 })}`;
  };

  const handleFundWallet = (wallet: Wallet) => {
    setSelectedWallet(wallet);
    setPaymentDialogOpen(true);
  };

  const handlePaymentSuccess = () => {
    setPaymentDialogOpen(false);
    setSelectedWallet(null);
    fetchWallets(); // Refresh wallet balances
    toast({
      title: 'Payment Successful',
      description: 'Your wallet has been funded successfully',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Wallets</h1>
          <p className="text-sm text-primary">Manage your multi-currency wallets</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />New Wallet</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Wallet</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                <SelectTrigger><SelectValue placeholder="Select currency" /></SelectTrigger>
                <SelectContent>
                  {currencies.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={createWallet} disabled={!selectedCurrency || creating} className="w-full">
                {creating ? 'Creating...' : 'Create Wallet'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map(i => <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : wallets.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <p className="text-muted-foreground">No wallets created yet</p>
          <p className="text-sm text-muted-foreground">Click "New Wallet" to get started</p>
        </div>
      ) : (
        <div className="space-y-4">
          {wallets.map(wallet => (
            <div key={wallet.id} className="border border-border rounded-xl p-5 bg-card space-y-3">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 text-xs font-semibold rounded-full bg-primary text-primary-foreground">
                  {wallet.status}
                </span>
                <span className="text-sm font-medium text-muted-foreground">{wallet.currency}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{formatBalance(wallet.balance, wallet.currency)}</p>
              <p className="text-xs text-muted-foreground">ID: {wallet.wallet_number}</p>
              {wallet.wallet_address && (
                <p className="text-xs text-muted-foreground font-mono truncate">
                  {wallet.wallet_address.slice(0, 8)}...{wallet.wallet_address.slice(-6)}
                </p>
              )}
              {wallet.type === 'crypto' ? (
                <Button className="w-full" variant="outline" disabled>
                  <Wallet className="w-4 h-4 mr-2" />
                  Crypto Deposit (Coming Soon)
                </Button>
              ) : (
                <Button className="w-full" onClick={() => handleFundWallet(wallet)}>
                  <Wallet className="w-4 h-4 mr-2" />
                  Fund Wallet
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedWallet && (
        <PaystackPayment
          wallet={selectedWallet}
          isOpen={paymentDialogOpen}
          onClose={() => {
            setPaymentDialogOpen(false);
            setSelectedWallet(null);
          }}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
};

export default WalletsPage;
