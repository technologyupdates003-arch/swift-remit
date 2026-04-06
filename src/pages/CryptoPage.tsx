import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Bitcoin, Send, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Wallet {
  id: string;
  currency: string;
  balance: number;
  wallet_number: string;
  wallet_address: string | null;
}

const CryptoPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendOpen, setSendOpen] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);
  const [sendAddress, setSendAddress] = useState('');
  const [sendAmount, setSendAmount] = useState('');

  useEffect(() => {
    if (!user) return;
    supabase.from('wallets').select('*').eq('user_id', user.id).eq('type', 'crypto')
      .order('created_at').then(({ data }) => {
        setWallets(data || []);
        setLoading(false);
      });
  }, [user]);

  const handleSend = async () => {
    if (!selectedWallet || !sendAddress || !sendAmount || !user) return;
    const { data, error } = await supabase.functions.invoke('crypto-send', {
      body: { user_id: user.id, wallet_id: selectedWallet.id, to_address: sendAddress, amount: parseFloat(sendAmount) },
    });
    if (error || !data?.success) {
      toast({ title: data?.message || 'Send failed', variant: 'destructive' });
    } else {
      toast({ title: 'Crypto sent successfully' });
      setSendOpen(false);
      setSendAddress('');
      setSendAmount('');
      supabase.from('wallets').select('*').eq('user_id', user.id).eq('type', 'crypto').then(({ data }) => setWallets(data || []));
    }
  };

  const coins: Record<string, { name: string; color: string }> = {
    BTC: { name: 'Bitcoin', color: 'text-warning' },
    ETH: { name: 'Ethereum', color: 'text-primary' },
    USDT: { name: 'Tether', color: 'text-primary' },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">AbanRemit Crypto</h1>
          <p className="text-sm text-muted-foreground">Buy, sell, and transfer cryptocurrency</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="default"><Download className="w-4 h-4 mr-1" />Buy</Button>
          <Button size="sm" variant="outline" onClick={() => { if (wallets.length > 0) { setSelectedWallet(wallets[0]); setSendOpen(true); } }}>
            <Send className="w-4 h-4 mr-1" />Send
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">{[1, 2].map(i => <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : wallets.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No crypto wallets. Create one from My Wallets.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {wallets.map(w => (
            <div key={w.id} className="border border-border rounded-xl p-5 bg-card space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                  <Bitcoin className={`w-5 h-5 ${coins[w.currency]?.color || 'text-foreground'}`} />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{w.currency}</p>
                  <p className="text-xs text-muted-foreground">{coins[w.currency]?.name || w.currency}</p>
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">{Number(w.balance).toLocaleString(undefined, { maximumFractionDigits: 6 })}</p>
              {w.wallet_address && (
                <p className="text-xs text-muted-foreground font-mono">
                  {w.wallet_address.slice(0, 8)}...{w.wallet_address.slice(-6)}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send Crypto</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="flex gap-2">
              {wallets.map(w => (
                <button
                  key={w.id}
                  onClick={() => setSelectedWallet(w)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border ${
                    selectedWallet?.id === w.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-foreground border-border'
                  }`}
                >
                  {w.currency}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Wallet Address</label>
              <Input placeholder="0x..." value={sendAddress} onChange={(e) => setSendAddress(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Amount ({selectedWallet?.currency})</label>
              <Input type="number" placeholder="0.00" value={sendAmount} onChange={(e) => setSendAmount(e.target.value)} />
            </div>
            <Button onClick={handleSend} className="w-full" disabled={!sendAddress || !sendAmount}>
              Send {selectedWallet?.currency}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CryptoPage;
