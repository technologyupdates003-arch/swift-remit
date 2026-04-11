import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Plus, Wallet, Copy, Share2, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import PaystackPayment from '@/components/PaystackPayment';

interface WalletData {
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
  const [wallets, setWallets] = useState<WalletData[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<WalletData | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchWallets = useCallback(async () => {
    if (!user) return;
    const { data: userId } = await supabase.rpc('get_user_id_from_auth');
    if (!userId) { setLoading(false); return; }
    const { data } = await supabase.from('wallets').select('*').eq('user_id', userId).order('created_at', { ascending: true });
    setWallets(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchWallets(); }, [fetchWallets]);

  // Real-time wallet balance updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('wallet-balance-updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'wallets' },
        (payload) => {
          setWallets(prev =>
            prev.map(w => w.id === payload.new.id ? { ...w, ...payload.new } as WalletData : w)
          );
          const updated = payload.new as any;
          const old = payload.old as any;
          if (updated.balance > old.balance) {
            toast({
              title: '💰 Wallet Funded!',
              description: `Your ${updated.currency} wallet received ${(updated.balance - old.balance).toLocaleString()} ${updated.currency}`,
            });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, toast]);

  const createWallet = async () => {
    if (!selectedCurrency || !user) return;
    const existing = wallets.find(w => w.currency === selectedCurrency);
    if (existing) {
      toast({ title: `You already have a ${selectedCurrency} wallet`, variant: 'destructive' });
      return;
    }
    setCreating(true);

    const { data: userId } = await supabase.rpc('get_user_id_from_auth');
    if (!userId) {
      toast({ title: 'User profile not found', variant: 'destructive' });
      setCreating(false);
      return;
    }

    const currencyInfo = currencies.find(c => c.value === selectedCurrency);
    const walletNumber = `WLT-${selectedCurrency}-${Date.now()}`;
    const walletAddress = currencyInfo?.type === 'crypto' ? `0x${Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}` : null;

    const { error } = await supabase.from('wallets').insert({
      user_id: userId,
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

  const handleFundWallet = (wallet: WalletData) => {
    setSelectedWallet(wallet);
    setPaymentDialogOpen(true);
  };

  const handlePaymentSuccess = () => {
    setPaymentDialogOpen(false);
    setSelectedWallet(null);
    fetchWallets();
    toast({ title: 'Payment Successful', description: 'Your wallet has been funded successfully' });
  };

  const copyToClipboard = async (text: string, walletId: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(walletId);
      toast({ title: 'Copied!', description: `${label} copied to clipboard` });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  };

  const shareWallet = async (wallet: WalletData) => {
    const shareText = `Send money to my AbanRemit wallet:\nWallet Number: ${wallet.wallet_number}${wallet.wallet_address ? `\nWallet Address: ${wallet.wallet_address}` : ''}\nCurrency: ${wallet.currency}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'My AbanRemit Wallet', text: shareText });
      } catch {
        // User cancelled share
      }
    } else {
      await copyToClipboard(shareText, wallet.id + '-share', 'Wallet details');
    }
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

              {/* Wallet Number with Copy */}
              <div className="flex items-center justify-between bg-muted rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Wallet Number</p>
                  <p className="text-sm font-mono text-foreground truncate">{wallet.wallet_number}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => copyToClipboard(wallet.wallet_number, wallet.id, 'Wallet number')}
                  >
                    {copiedId === wallet.id ? (
                      <Check className="w-4 h-4 text-primary" />
                    ) : (
                      <Copy className="w-4 h-4 text-muted-foreground" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => shareWallet(wallet)}
                  >
                    <Share2 className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>

              {/* Crypto Wallet Address with Copy */}
              {wallet.wallet_address && (
                <div className="flex items-center justify-between bg-muted rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Wallet Address</p>
                    <p className="text-xs font-mono text-foreground truncate">
                      {wallet.wallet_address.slice(0, 10)}...{wallet.wallet_address.slice(-8)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 shrink-0"
                    onClick={() => copyToClipboard(wallet.wallet_address!, wallet.id + '-addr', 'Wallet address')}
                  >
                    {copiedId === wallet.id + '-addr' ? (
                      <Check className="w-4 h-4 text-primary" />
                    ) : (
                      <Copy className="w-4 h-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
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
