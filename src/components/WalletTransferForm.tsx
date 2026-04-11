import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Wallet, Shield, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';

interface WalletTransferFormProps {
  wallet: {
    id: string;
    currency: string;
    balance: number;
    wallet_number: string;
  };
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const WalletTransferForm = ({ wallet, isOpen, onClose, onSuccess }: WalletTransferFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [recipientWallet, setRecipientWallet] = useState('');
  const [narrative, setNarrative] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'form' | 'processing' | 'success'>('form');

  const validateInputs = () => {
    if (!amount || parseFloat(amount) <= 0) return 'Please enter a valid amount';
    if (parseFloat(amount) < 1) return 'Minimum transfer amount is 1';
    if (parseFloat(amount) > wallet.balance) return 'Insufficient balance';
    if (!recipientWallet.trim()) return 'Please enter recipient wallet number';

    // Flexible wallet number validation: WLT-XXX-XXXXXXXXX
    if (!recipientWallet.match(/^WLT-[A-Z]{2,5}-\d{5,}$/i)) {
      return 'Invalid wallet number format. Use format like WLT-KES-1234567890';
    }

    if (recipientWallet.toUpperCase() === wallet.wallet_number.toUpperCase()) {
      return 'Cannot transfer to your own wallet';
    }
    return null;
  };

  const handleTransfer = async () => {
    const validationError = validateInputs();
    if (validationError) {
      toast({ title: 'Validation Error', description: validationError, variant: 'destructive' });
      return;
    }
    if (!user) return;

    setLoading(true);
    setStep('processing');

    try {
      const { data: dataRaw, error } = await supabase.rpc('intasend_wallet_transfer', {
        p_from_wallet_id: wallet.id,
        p_to_wallet_number: recipientWallet.toUpperCase(),
        p_amount: parseFloat(amount),
        p_narrative: narrative.trim() || 'Wallet transfer',
      });
      if (error) throw error;

      const data = dataRaw as any;
      if (data?.success) {
        toast({
          title: 'Transfer Successful',
          description: `${getCurrencySymbol(wallet.currency)}${parseFloat(amount).toLocaleString()} sent to ${recipientWallet}`,
        });
        setStep('success');
        setTimeout(() => { onSuccess(); onClose(); resetForm(); }, 3000);
      } else {
        throw new Error(data?.error || 'Transfer failed');
      }
    } catch (error: any) {
      toast({ title: 'Transfer Error', description: error.message || 'Failed to process wallet transfer', variant: 'destructive' });
      setStep('form');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setAmount(''); setRecipientWallet(''); setNarrative(''); setStep('form'); setLoading(false);
  };

  const handleClose = () => { resetForm(); onClose(); };

  const getCurrencySymbol = (currency: string) => {
    const symbols: Record<string, string> = { KES: 'KSh', USD: '$', EUR: '€', NGN: '₦' };
    return symbols[currency] || currency;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            Wallet Transfer
          </DialogTitle>
          <DialogDescription>Send money to another AbanRemit wallet instantly</DialogDescription>
        </DialogHeader>

        {step === 'form' ? (
          <div className="space-y-6 pt-4">
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm text-muted-foreground">Available Balance: {getCurrencySymbol(wallet.currency)}{wallet.balance.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">From Wallet: {wallet.wallet_number}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="recipient">Recipient Wallet Number</Label>
              <Input
                id="recipient"
                type="text"
                placeholder="WLT-KES-1234567890"
                value={recipientWallet}
                onChange={(e) => setRecipientWallet(e.target.value.toUpperCase())}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">Enter the recipient's wallet number (e.g., WLT-KES-1234567890)</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Transfer Amount ({getCurrencySymbol(wallet.currency)})</Label>
              <Input
                id="amount"
                type="number"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="1"
                max={wallet.balance}
                step="0.01"
                className="text-lg font-semibold"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Minimum: {getCurrencySymbol(wallet.currency)}1</span>
                <span>No fees for wallet transfers</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="narrative">Description (Optional)</Label>
              <Textarea
                id="narrative"
                placeholder="What's this transfer for?"
                value={narrative}
                onChange={(e) => setNarrative(e.target.value)}
                maxLength={100}
                rows={2}
              />
              <p className="text-xs text-muted-foreground">{narrative.length}/100 characters</p>
            </div>

            {amount && parseFloat(amount) > 0 && recipientWallet && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <h4 className="text-sm font-medium text-foreground mb-3">Transfer Preview</h4>
                <div className="flex items-center justify-between">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">From</p>
                    <p className="font-mono text-xs font-semibold text-foreground">{wallet.wallet_number}</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-primary" />
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">To</p>
                    <p className="font-mono text-xs font-semibold text-foreground">{recipientWallet}</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Amount:</span><span className="font-semibold text-foreground">{getCurrencySymbol(wallet.currency)}{parseFloat(amount).toLocaleString()}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Fee:</span><span className="font-semibold text-primary">FREE</span></div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-1"><span>Remaining Balance:</span><span>{getCurrencySymbol(wallet.currency)}{(wallet.balance - parseFloat(amount)).toLocaleString()}</span></div>
                </div>
              </div>
            )}

            {amount && parseFloat(amount) > wallet.balance && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-destructive">Insufficient Balance</p>
                    <p className="text-sm text-muted-foreground">
                      You need {getCurrencySymbol(wallet.currency)}{parseFloat(amount).toLocaleString()} but only have {getCurrencySymbol(wallet.currency)}{wallet.balance.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose} className="flex-1" disabled={loading}>Cancel</Button>
              <Button onClick={handleTransfer} className="flex-1" disabled={loading || !amount || !recipientWallet || parseFloat(amount) > wallet.balance}>
                {loading ? 'Processing...' : `Send ${getCurrencySymbol(wallet.currency)}${amount || '0'}`}
              </Button>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Shield className="w-4 h-4" />
              <span>Secured by AbanRemit</span>
            </div>
          </div>
        ) : step === 'processing' ? (
          <div className="space-y-6 pt-4">
            <div className="text-center py-8">
              <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Processing Transfer</h3>
              <p className="text-muted-foreground mb-4">Your wallet transfer is being processed</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6 pt-4">
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Transfer Successful!</h3>
              <p className="text-muted-foreground">
                {getCurrencySymbol(wallet.currency)}{parseFloat(amount).toLocaleString()} sent to {recipientWallet}
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default WalletTransferForm;
