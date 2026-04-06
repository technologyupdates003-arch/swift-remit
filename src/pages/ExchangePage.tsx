import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw } from 'lucide-react';

interface Wallet {
  id: string;
  currency: string;
  balance: number;
  wallet_number: string;
}

interface Rate {
  from_currency: string;
  to_currency: string;
  rate: number;
}

const ExchangePage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);
  const [fromWallet, setFromWallet] = useState('');
  const [toWallet, setToWallet] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('wallets').select('*').eq('user_id', user.id).then(({ data }) => setWallets(data || []));
    supabase.from('exchange_rates').select('*').then(({ data }) => setRates(data || []));
  }, [user]);

  const fromW = wallets.find(w => w.id === fromWallet);
  const toW = wallets.find(w => w.id === toWallet);
  const rate = fromW && toW ? rates.find(r => r.from_currency === fromW.currency && r.to_currency === toW.currency)?.rate || 0 : 0;
  const convertedAmount = parseFloat(amount || '0') * rate;

  const handleExchange = async () => {
    if (!fromW || !toW || !amount || !user) return;
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('exchange-currency', {
      body: { user_id: user.id, from_wallet_id: fromW.id, to_wallet_id: toW.id, amount: parseFloat(amount) },
    });
    setLoading(false);
    if (error || !data?.success) {
      toast({ title: data?.message || 'Exchange failed', variant: 'destructive' });
    } else {
      toast({ title: 'Exchange successful!' });
      setAmount('');
      supabase.from('wallets').select('*').eq('user_id', user.id).then(({ data }) => setWallets(data || []));
    }
  };

  return (
    <div className="space-y-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-foreground">Exchange</h1>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">From Wallet</label>
          <Select value={fromWallet} onValueChange={setFromWallet}>
            <SelectTrigger><SelectValue placeholder="Select source wallet" /></SelectTrigger>
            <SelectContent>
              {wallets.map(w => (
                <SelectItem key={w.id} value={w.id}>{w.currency} - {Number(w.balance).toLocaleString()}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex justify-center">
          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
            <RefreshCw className="w-4 h-4 text-primary" />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">To Wallet</label>
          <Select value={toWallet} onValueChange={setToWallet}>
            <SelectTrigger><SelectValue placeholder="Select destination wallet" /></SelectTrigger>
            <SelectContent>
              {wallets.filter(w => w.id !== fromWallet).map(w => (
                <SelectItem key={w.id} value={w.id}>{w.currency} - {Number(w.balance).toLocaleString()}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Amount</label>
          <Input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>

        {rate > 0 && amount && (
          <div className="p-4 rounded-xl bg-secondary">
            <p className="text-sm text-muted-foreground">Rate: 1 {fromW?.currency} = {rate} {toW?.currency}</p>
            <p className="text-lg font-bold text-foreground">You'll receive: {convertedAmount.toLocaleString(undefined, { maximumFractionDigits: 6 })} {toW?.currency}</p>
          </div>
        )}

        <Button onClick={handleExchange} disabled={loading || !fromWallet || !toWallet || !amount} className="w-full">
          {loading ? 'Exchanging...' : 'Exchange'}
        </Button>
      </div>
    </div>
  );
};

export default ExchangePage;
