import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, Smartphone, Building2, Wallet, ArrowLeft } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';

interface WalletData {
  id: string;
  currency: string;
  balance: number;
  wallet_number: string;
  type: string;
}

type WithdrawMethod = null | 'mpesa' | 'bank' | 'wallet';
type Step = 'method' | 'details' | 'summary' | 'pin' | 'success';

const WithdrawPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [method, setMethod] = useState<WithdrawMethod>(null);
  const [step, setStep] = useState<Step>('method');
  const [wallets, setWallets] = useState<WalletData[]>([]);
  const [selectedWallet, setSelectedWallet] = useState('');
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  // M-Pesa fields
  const [mpesaPhone, setMpesaPhone] = useState('');

  // Bank fields
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');

  // Wallet fields
  const [recipientWalletId, setRecipientWalletId] = useState('');

  useEffect(() => {
    if (!user) return;
    supabase.from('wallets').select('*').eq('user_id', user.id).then(({ data }) => {
      setWallets(data || []);
    });
  }, [user]);

  const wallet = wallets.find(w => w.id === selectedWallet);
  const fee = parseFloat(amount || '0') * (method === 'mpesa' ? 0.005 : method === 'bank' ? 0.01 : 0.002);
  const total = parseFloat(amount || '0') + fee;

  const methodOptions = [
    { key: 'mpesa' as const, icon: Smartphone, label: 'M-Pesa', desc: 'Withdraw to phone number' },
    { key: 'bank' as const, icon: Building2, label: 'Bank Transfer', desc: 'Withdraw to bank account' },
    { key: 'wallet' as const, icon: Wallet, label: 'To Wallet', desc: 'Transfer to another wallet' },
  ];

  const canProceedDetails = () => {
    if (!selectedWallet || !amount || parseFloat(amount) <= 0) return false;
    if (method === 'mpesa' && !mpesaPhone) return false;
    if (method === 'bank' && (!bankName || !accountNumber || !accountName)) return false;
    if (method === 'wallet' && !recipientWalletId) return false;
    if (wallet && total > Number(wallet.balance)) return false;
    return true;
  };

  const handleWithdraw = async () => {
    if (!user || !wallet || pin.length < 4) return;
    setLoading(true);

    if (method === 'wallet') {
      // Use existing send-money function for wallet-to-wallet
      try {
        const { data, error } = await supabase.functions.invoke('send-money', {
          body: {
            sender_user_id: user.id,
            sender_wallet_id: wallet.id,
            receiver_wallet_id: recipientWalletId,
            amount: parseFloat(amount),
            pin,
          },
        });
        if (error || !data?.success) {
          toast({ title: data?.message || 'Withdrawal failed', variant: 'destructive' });
          if (data?.message?.includes('PIN')) setPin('');
        } else {
          setStep('success');
        }
      } catch {
        toast({ title: 'Withdrawal failed', variant: 'destructive' });
      }
    } else {
      // M-Pesa or Bank — record as pending withdrawal transaction
      const destination = method === 'mpesa'
        ? `M-Pesa: ${mpesaPhone}`
        : `Bank: ${bankName} - ${accountNumber} (${accountName})`;

      const { error } = await supabase.from('transactions').insert({
        user_id: user.id,
        wallet_id: wallet.id,
        type: 'withdrawal' as const,
        amount: parseFloat(amount),
        fee,
        currency: wallet.currency,
        status: 'pending' as const,
        reference: `WD-${method?.toUpperCase()}-${Date.now()}`,
        network: destination,
      });

      if (error) {
        toast({ title: 'Withdrawal failed', description: error.message, variant: 'destructive' });
      } else {
        setStep('success');
      }
    }
    setLoading(false);
  };

  const reset = () => {
    setMethod(null);
    setStep('method');
    setAmount('');
    setPin('');
    setSelectedWallet('');
    setMpesaPhone('');
    setBankName('');
    setAccountNumber('');
    setAccountName('');
    setRecipientWalletId('');
  };

  return (
    <div className="space-y-6 max-w-md mx-auto">
      <div className="flex items-center gap-3">
        {step !== 'method' && step !== 'success' && (
          <button onClick={() => setStep(step === 'details' ? 'method' : step === 'summary' ? 'details' : 'summary')}>
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
        )}
        <h1 className="text-2xl font-bold text-foreground">Withdraw Money</h1>
      </div>

      {step === 'method' && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Choose withdrawal method</p>
          {methodOptions.map(opt => (
            <button
              key={opt.key}
              onClick={() => { setMethod(opt.key); setStep('details'); }}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary transition-colors text-left"
            >
              <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center shrink-0">
                <opt.icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.desc}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {step === 'details' && (
        <div className="space-y-4">
          <div className="px-3 py-2 rounded-lg bg-secondary text-sm font-medium text-primary capitalize">
            {method === 'mpesa' ? 'M-Pesa Withdrawal' : method === 'bank' ? 'Bank Transfer' : 'Wallet Transfer'}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">From Wallet</label>
            <Select value={selectedWallet} onValueChange={setSelectedWallet}>
              <SelectTrigger><SelectValue placeholder="Select wallet" /></SelectTrigger>
              <SelectContent>
                {wallets.filter(w => method === 'mpesa' ? w.currency === 'KES' : true).map(w => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.currency} — {Number(w.balance).toLocaleString()} ({w.wallet_number})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {method === 'mpesa' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">M-Pesa Phone Number</label>
              <Input placeholder="254712345678" value={mpesaPhone} onChange={e => setMpesaPhone(e.target.value)} />
            </div>
          )}

          {method === 'bank' && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Bank Name</label>
                <Input placeholder="e.g. KCB, Equity" value={bankName} onChange={e => setBankName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Account Number</label>
                <Input placeholder="Account number" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Account Name</label>
                <Input placeholder="Account holder name" value={accountName} onChange={e => setAccountName(e.target.value)} />
              </div>
            </>
          )}

          {method === 'wallet' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Recipient Wallet ID</label>
              <Input placeholder="WLT-KES-1234567890" value={recipientWalletId} onChange={e => setRecipientWalletId(e.target.value)} />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Amount {wallet ? `(${wallet.currency})` : ''}</label>
            <Input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
            {wallet && parseFloat(amount || '0') > 0 && total > Number(wallet.balance) && (
              <p className="text-xs text-destructive">Insufficient balance</p>
            )}
          </div>

          <Button onClick={() => setStep('summary')} disabled={!canProceedDetails()} className="w-full">
            Continue
          </Button>
        </div>
      )}

      {step === 'summary' && wallet && (
        <div className="space-y-4">
          <div className="border border-border rounded-xl p-5 bg-card space-y-3">
            <p className="font-semibold text-foreground">Withdrawal Summary</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Method</span>
                <span className="font-medium text-foreground capitalize">{method === 'mpesa' ? 'M-Pesa' : method}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">From</span>
                <span className="font-medium text-foreground">{wallet.wallet_number}</span>
              </div>
              {method === 'mpesa' && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">To Phone</span>
                  <span className="font-medium text-foreground">{mpesaPhone}</span>
                </div>
              )}
              {method === 'bank' && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bank</span>
                    <span className="font-medium text-foreground">{bankName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Account</span>
                    <span className="font-medium text-foreground">{accountNumber}</span>
                  </div>
                </>
              )}
              {method === 'wallet' && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">To Wallet</span>
                  <span className="font-medium text-foreground">{recipientWalletId}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-medium text-foreground">{wallet.currency} {parseFloat(amount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fee</span>
                <span className="font-medium text-foreground">{wallet.currency} {fee.toFixed(2)}</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between">
                <span className="font-semibold text-foreground">Total</span>
                <span className="font-bold text-foreground">{wallet.currency} {total.toFixed(2)}</span>
              </div>
            </div>
          </div>
          <Button onClick={() => setStep('pin')} className="w-full">Confirm & Enter PIN</Button>
        </div>
      )}

      {step === 'pin' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Enter your PIN</label>
            <Input
              type="password"
              maxLength={4}
              placeholder="••••"
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
              className="text-center text-2xl tracking-widest"
            />
          </div>
          <Button onClick={handleWithdraw} disabled={loading || pin.length < 4} className="w-full">
            {loading ? 'Processing...' : 'Withdraw'}
          </Button>
        </div>
      )}

      {step === 'success' && (
        <div className="text-center space-y-4 py-8">
          <CheckCircle className="w-16 h-16 text-primary mx-auto" />
          <h2 className="text-xl font-bold text-foreground">Withdrawal Submitted!</h2>
          <p className="text-sm text-muted-foreground">
            {wallet?.currency} {parseFloat(amount).toLocaleString()} withdrawal via {method === 'mpesa' ? 'M-Pesa' : method} is being processed.
          </p>
          <Button onClick={reset} variant="outline" className="w-full">Done</Button>
        </div>
      )}
    </div>
  );
};

export default WithdrawPage;
