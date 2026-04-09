import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { paymentService } from '@/services/paymentService';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Smartphone, Shield, CheckCircle } from 'lucide-react';

interface MpesaPaymentFormProps {
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

const MpesaPaymentForm = ({ wallet, isOpen, onClose, onSuccess }: MpesaPaymentFormProps) => {
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'form' | 'processing' | 'success'>('form');
  const [requestId, setRequestId] = useState('');

  const isMpesaSupported = wallet.currency === 'KES';

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.startsWith('254')) return digits.slice(0, 12);
    if (digits.startsWith('0')) return '254' + digits.slice(1, 10);
    if (digits.startsWith('7') || digits.startsWith('1')) return '254' + digits.slice(0, 9);
    return digits.slice(0, 12);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhoneNumber(formatPhoneNumber(e.target.value));
  };

  const validateInputs = () => {
    if (!amount || parseFloat(amount) <= 0) return 'Please enter a valid amount';
    if (parseFloat(amount) < 10) return 'Minimum amount is KSh 10';
    if (!phoneNumber || phoneNumber.length !== 12) return 'Please enter a valid M-Pesa phone number';
    if (!phoneNumber.match(/^254[17][0-9]{8}$/)) return 'Invalid M-Pesa number format';
    return null;
  };

  const handlePayment = async () => {
    const validationError = validateInputs();
    if (validationError) {
      toast({ title: 'Validation Error', description: validationError, variant: 'destructive' });
      return;
    }

    setLoading(true);
    setStep('processing');

    try {
      const result = await paymentService.mpesaSTKPush({
        phone_number: phoneNumber,
        amount: parseFloat(amount),
        currency: wallet.currency,
        narrative: 'AbanRemit wallet funding',
        wallet_id: wallet.id,
      });

      toast({
        title: 'STK Push Sent!',
        description: `Check your phone ${phoneNumber} for M-Pesa prompt`,
      });

      setStep('success');
      setRequestId(result.api_ref || result.reference || '');

      setTimeout(() => {
        onSuccess();
        onClose();
        resetForm();
      }, 5000);

    } catch (error: any) {
      console.error('Payment error:', error);
      toast({
        title: 'Payment Failed',
        description: error.message || 'Failed to initiate M-Pesa payment',
        variant: 'destructive',
      });
      setStep('form');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setAmount('');
    setPhoneNumber('');
    setStep('form');
    setLoading(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-green-600" />
            Pay with M-Pesa
          </DialogTitle>
          <DialogDescription>
            Fund your wallet using M-Pesa mobile money
          </DialogDescription>
        </DialogHeader>
        
        {!isMpesaSupported ? (
          <div className="space-y-4 pt-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                M-Pesa payments are only available for KES wallets. Current: {wallet.currency}
              </p>
            </div>
            <Button onClick={handleClose} className="w-full">Close</Button>
          </div>
        ) : step === 'form' ? (
          <div className="space-y-6 pt-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (KSh)</Label>
              <Input
                id="amount"
                type="number"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="10"
                step="1"
                className="text-lg font-semibold"
              />
              <p className="text-xs text-muted-foreground">Min: KSh 10 • Max: KSh 150,000</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">M-Pesa Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="254712345678"
                value={phoneNumber}
                onChange={handlePhoneChange}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">Safaricom number (254XXXXXXXXX)</p>
            </div>

            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Balance: KSh {wallet.balance.toLocaleString()} • Wallet: {wallet.wallet_number}
              </p>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <Smartphone className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-green-900">How it works</p>
                  <ol className="text-sm text-green-800 space-y-1 mt-1 list-decimal list-inside">
                    <li>Enter amount and M-Pesa number</li>
                    <li>You'll receive an STK push on your phone</li>
                    <li>Enter your M-Pesa PIN to complete</li>
                    <li>Your wallet will be credited automatically</li>
                  </ol>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose} className="flex-1" disabled={loading}>
                Cancel
              </Button>
              <Button
                onClick={handlePayment}
                className="flex-1 bg-green-600 hover:bg-green-700"
                disabled={loading || !amount || !phoneNumber}
              >
                {loading ? 'Processing...' : `Pay KSh ${amount || '0'}`}
              </Button>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Shield className="w-4 h-4" />
              <span>Secured by Safaricom M-Pesa</span>
            </div>
          </div>
        ) : step === 'processing' ? (
          <div className="space-y-6 pt-4">
            <div className="text-center py-8">
              <div className="w-16 h-16 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Processing M-Pesa Payment</h3>
              <p className="text-muted-foreground mb-4">Check your phone for the M-Pesa prompt</p>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800">
                  <strong>Amount:</strong> KSh {parseFloat(amount).toLocaleString()}<br />
                  <strong>Phone:</strong> {phoneNumber}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6 pt-4">
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-green-900 mb-2">STK Push Sent!</h3>
              <p className="text-muted-foreground mb-4">Check your phone for the M-Pesa payment prompt</p>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Smartphone className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-green-900">Payment Details</span>
                </div>
                <p className="text-sm text-green-800">
                  <strong>Amount:</strong> KSh {parseFloat(amount).toLocaleString()}<br />
                  <strong>Phone:</strong> {phoneNumber}<br />
                  {requestId && <><strong>Reference:</strong> {requestId}</>}
                </p>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Enter your M-Pesa PIN on your phone to complete the payment
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MpesaPaymentForm;
