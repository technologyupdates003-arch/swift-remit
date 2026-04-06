import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react';

interface Wallet {
  id: string;
  currency: string;
  balance: number;
  wallet_number: string;
}

interface RecipientInfo {
  full_name: string;
  phone: string;
  wallet_id: string;
  currency: string;
  status: string;
}

type Step = 'lookup' | 'confirm_recipient' | 'amount' | 'summary' | 'pin' | 'success';

const SendMoneyPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('lookup');
  const [walletIdInput, setWalletIdInput] = useState('');
  const [recipient, setRecipient] = useState<RecipientInfo | null>(null);
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [senderWallets, setSenderWallets] = useState<Wallet[]>([]);
  const [selectedSenderWallet, setSelectedSenderWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(false);
  const [recipientWalletId, setRecipientWalletId] = useState('');

  useEffect(() => {
    if (!user) return;
    supabase.from('wallets').select('*').eq('user_id', user.id).then(({ data }) => {
      setSenderWallets(data || []);
    });
  }, [user]);

  const lookupRecipient = async () => {
    if (!walletIdInput.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('lookup-wallet', {
        body: { wallet_id: walletIdInput, sender_user_id: user?.id },
      });
      if (error || !data?.success) {
        toast({ title: data?.message || 'Wallet not found', variant: 'destructive' });
      } else {
        setRecipient(data.recipient);
        setRecipientWalletId(data.recipient.wallet_id);
        // Auto-select matching currency sender wallet
        const match = senderWallets.find(w => w.currency === data.recipient.currency);
        if (match) setSelectedSenderWallet(match);
        setStep('confirm_recipient');
      }
    } catch {
      toast({ title: 'Failed to lookup wallet', variant: 'destructive' });
    }
    setLoading(false);
  };

  const handleSend = async () => {
    if (!selectedSenderWallet || !recipient || !amount || !pin || !user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-money', {
        body: {
          sender_user_id: user.id,
          sender_wallet_id: selectedSenderWallet.id,
          receiver_wallet_id: recipientWalletId,
          amount: parseFloat(amount),
          pin,
        },
      });
      if (error || !data?.success) {
        toast({ title: data?.message || 'Transfer failed', variant: 'destructive' });
        if (data?.message?.includes('PIN')) setPin('');
      } else {
        setStep('success');
      }
    } catch {
      toast({ title: 'Transfer failed', variant: 'destructive' });
    }
    setLoading(false);
  };

  const maskPhone = (phone: string) => {
    if (phone.length < 6) return phone;
    return phone.slice(0, 4) + '****' + phone.slice(-3);
  };

  const fee = parseFloat(amount || '0') * 0.002; // 0.2% fee
  const total = parseFloat(amount || '0') + fee;

  return (
    <div className="space-y-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-foreground">Send Money</h1>

      {step === 'lookup' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Recipient Wallet ID</label>
            <Input
              placeholder="WLT-KES-1234567890"
              value={walletIdInput}
              onChange={(e) => setWalletIdInput(e.target.value)}
            />
          </div>
          <Button onClick={lookupRecipient} disabled={loading || !walletIdInput} className="w-full">
            {loading ? 'Looking up...' : 'Verify Recipient'}
          </Button>
        </div>
      )}

      {step === 'confirm_recipient' && recipient && (
        <div className="space-y-4">
          <div className="border border-border rounded-xl p-5 bg-card space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-primary" />
              <span className="font-semibold text-foreground">Recipient Found</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span className="font-medium text-foreground">{recipient.full_name || 'N/A'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span className="font-medium text-foreground">{maskPhone(recipient.phone)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Wallet</span><span className="font-medium text-foreground">{recipient.wallet_id}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Currency</span><span className="font-medium text-foreground">{recipient.currency}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="font-medium text-primary">{recipient.status}</span></div>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
            <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
            <p className="text-xs text-foreground">Confirm recipient details carefully. Transfers cannot be reversed.</p>
          </div>
          <Button onClick={() => setStep('amount')} className="w-full">Continue</Button>
          <button onClick={() => { setStep('lookup'); setRecipient(null); }} className="w-full text-sm text-primary">
            Change recipient
          </button>
        </div>
      )}

      {step === 'amount' && (
        <div className="space-y-4">
          {selectedSenderWallet && (
            <p className="text-sm text-muted-foreground">
              From: {selectedSenderWallet.wallet_number} (Balance: {Number(selectedSenderWallet.balance).toLocaleString()} {selectedSenderWallet.currency})
            </p>
          )}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Amount ({recipient?.currency})</label>
            <Input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <Button onClick={() => setStep('summary')} disabled={!amount || parseFloat(amount) <= 0} className="w-full">
            Continue
          </Button>
        </div>
      )}

      {step === 'summary' && recipient && (
        <div className="space-y-4">
          <div className="border border-border rounded-xl p-5 bg-card space-y-3">
            <p className="font-semibold text-foreground">Transfer Summary</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-medium text-foreground">{recipient.currency} {parseFloat(amount).toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">To</span><span className="font-medium text-foreground">{recipient.full_name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Wallet</span><span className="font-medium text-foreground">{recipient.wallet_id}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Fee</span><span className="font-medium text-foreground">{recipient.currency} {fee.toFixed(2)}</span></div>
              <div className="border-t border-border pt-2 flex justify-between"><span className="font-semibold text-foreground">Total</span><span className="font-bold text-foreground">{recipient.currency} {total.toFixed(2)}</span></div>
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
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className="text-center text-2xl tracking-widest"
            />
          </div>
          <Button onClick={handleSend} disabled={loading || pin.length < 4} className="w-full">
            {loading ? 'Processing...' : 'Send Money'}
          </Button>
        </div>
      )}

      {step === 'success' && (
        <div className="text-center space-y-4 py-8">
          <CheckCircle className="w-16 h-16 text-primary mx-auto" />
          <h2 className="text-xl font-bold text-foreground">Transfer Successful!</h2>
          <p className="text-sm text-muted-foreground">
            {recipient?.currency} {parseFloat(amount).toLocaleString()} sent to {recipient?.full_name}
          </p>
          <Button onClick={() => { setStep('lookup'); setRecipient(null); setAmount(''); setPin(''); }} variant="outline" className="w-full">
            Send Another
          </Button>
        </div>
      )}
    </div>
  );
};

export default SendMoneyPage;
