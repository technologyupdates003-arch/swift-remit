import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { intaSendService } from '@/lib/intasend';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Smartphone, Shield, CheckCircle, AlertCircle } from 'lucide-react';

interface MpesaWithdrawFormProps {
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

const MpesaWithdrawForm = ({ wallet, isOpen, onClose, onSuccess }: MpesaWithdrawFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'form' | 'processing' | 'success'>('form');

  // Only support KES for M-Pesa
  const isMpesaSupported = wallet.currency === 'KES';
  const withdrawalFee = 10; // KES 10 fee

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');
    
    // Handle different input formats
    if (digits.startsWith('254')) {
      return digits.slice(0, 12); // 254XXXXXXXXX
    } else if (digits.startsWith('0')) {
      return '254' + digits.slice(1, 10); // 0XXXXXXXXX -> 254XXXXXXXXX
    } else if (digits.startsWith('7') || digits.startsWith('1')) {
      return '254' + digits.slice(0, 9); // 7XXXXXXXX -> 254XXXXXXXXX
    }
    
    return digits.slice(0, 12);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneNumber(formatted);
  };

  const validateInputs = () => {
    if (!amount || parseFloat(amount) <= 0) {
      return 'Please enter a valid amount';
    }
    
    if (parseFloat(amount) < 10) {
      return 'Minimum withdrawal amount is KSh 10';
    }

    const totalAmount = parseFloat(amount) + withdrawalFee;
    if (totalAmount > wallet.balance) {
      return `Insufficient balance. You need KSh ${totalAmount.toLocaleString()} (including KSh ${withdrawalFee} fee)`;
    }
    
    if (!phoneNumber || phoneNumber.length !== 12) {
      return 'Please enter a valid M-Pesa phone number';
    }
    
    if (!phoneNumber.match(/^254[17][0-9]{8}$/)) {
      return 'Invalid M-Pesa number format. Use 254XXXXXXXXX';
    }

    if (!recipientName.trim()) {
      return 'Please enter recipient name';
    }
    
    return null;
  };

  const handleWithdrawal = async () => {
    const validationError = validateInputs();
    if (validationError) {
      toast({
        title: 'Validation Error',
        description: validationError,
        variant: 'destructive',
      });
      return;
    }

    if (!user) return;

    setLoading(true);
    setStep('processing');

    try {
      // Step 1: Process withdrawal in database (deducts balance)
      const { data: dbResultRaw, error: dbError } = await supabase.rpc('intasend_mpesa_withdraw', {
        p_wallet_id: wallet.id,
        p_phone_number: phoneNumber,
        p_amount: parseFloat(amount),
        p_recipient_name: recipientName.trim()
      });

      if (dbError) throw dbError;

      const dbResult = dbResultRaw as any;
      if (!dbResult?.success) {
        throw new Error(dbResult?.error || 'Withdrawal failed');
      }

      const transactionId = dbResult.transaction_id;

      // Step 2: Initiate IntaSend B2C transfer
      const b2cResult = await intaSendService.initiateB2C({
        transactions: [{
          name: recipientName.trim(),
          account: phoneNumber,
          amount: parseFloat(amount),
          narrative: 'Swift Remit withdrawal'
        }],
        currency: 'KES',
        requires_approval: 'NO'
      });

      toast({
        title: 'Withdrawal Initiated',
        description: 'Your M-Pesa withdrawal is being processed',
      });

      // Step 3: Update transaction with IntaSend response
      await (supabase.rpc as any)('update_intasend_transaction_status', {
        p_transaction_id: transactionId,
        p_status: 'completed',
        p_intasend_response: b2cResult
      });

      setStep('success');

      // Auto-close after success
      setTimeout(() => {
        onSuccess();
        onClose();
        resetForm();
      }, 3000);

    } catch (error: any) {
      toast({
        title: 'Withdrawal Error',
        description: error.message || 'Failed to process M-Pesa withdrawal',
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
    setRecipientName('');
    setStep('form');
    setLoading(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const getCurrencySymbol = (currency: string) => {
    return currency === 'KES' ? 'KSh' : currency;
  };

  const totalAmount = parseFloat(amount || '0') + withdrawalFee;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-green-600" />
            Withdraw to M-Pesa
          </DialogTitle>
          <DialogDescription>
            Send money from your wallet to any M-Pesa number
          </DialogDescription>
        </DialogHeader>
        
        {!isMpesaSupported ? (
          <div className="space-y-4 pt-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                M-Pesa withdrawals are only available for KES wallets. 
                Current wallet currency: {wallet.currency}
              </p>
            </div>
            <Button onClick={handleClose} className="w-full">
              Close
            </Button>
          </div>
        ) : step === 'form' ? (
          <div className="space-y-6 pt-4">
            {/* Current Balance */}
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Available Balance: {getCurrencySymbol(wallet.currency)}{wallet.balance.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">
                Wallet: {wallet.wallet_number}
              </p>
            </div>

            {/* Amount Input */}
            <div className="space-y-2">
              <Label htmlFor="amount">Withdrawal Amount ({getCurrencySymbol(wallet.currency)})</Label>
              <Input
                id="amount"
                type="number"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="10"
                max={wallet.balance - withdrawalFee}
                step="1"
                className="text-lg font-semibold"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Minimum: KSh 10</span>
                <span>Fee: KSh {withdrawalFee}</span>
              </div>
            </div>

            {/* Recipient Name */}
            <div className="space-y-2">
              <Label htmlFor="recipient">Recipient Name</Label>
              <Input
                id="recipient"
                type="text"
                placeholder="Enter recipient's full name"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground">
                Name as registered with Safaricom
              </p>
            </div>

            {/* Phone Number Input */}
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
              <p className="text-xs text-muted-foreground">
                Recipient's Safaricom M-Pesa number (254XXXXXXXXX)
              </p>
            </div>

            {/* Transaction Summary */}
            {amount && parseFloat(amount) > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-blue-900 mb-2">Transaction Summary</h4>
                <div className="space-y-1 text-sm text-blue-800">
                  <div className="flex justify-between">
                    <span>Amount:</span>
                    <span>KSh {parseFloat(amount).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Fee:</span>
                    <span>KSh {withdrawalFee}</span>
                  </div>
                  <div className="flex justify-between font-semibold border-t border-blue-300 pt-1">
                    <span>Total Deducted:</span>
                    <span>KSh {totalAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>Remaining Balance:</span>
                    <span>KSh {(wallet.balance - totalAmount).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Warning for insufficient balance */}
            {amount && totalAmount > wallet.balance && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-900">Insufficient Balance</p>
                    <p className="text-sm text-red-800">
                      You need KSh {totalAmount.toLocaleString()} but only have KSh {wallet.balance.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleClose}
                className="flex-1"
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleWithdrawal}
                className="flex-1 bg-green-600 hover:bg-green-700"
                disabled={loading || !amount || !phoneNumber || !recipientName || totalAmount > wallet.balance}
              >
                {loading ? 'Processing...' : `Withdraw KSh ${amount || '0'}`}
              </Button>
            </div>

            {/* Security Notice */}
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Shield className="w-4 h-4" />
              <span>Secured by IntaSend & Safaricom M-Pesa</span>
            </div>
          </div>
        ) : step === 'processing' ? (
          <div className="space-y-6 pt-4">
            <div className="text-center py-8">
              <div className="w-16 h-16 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <h3 className="text-lg font-semibold mb-2">Processing Withdrawal</h3>
              <p className="text-muted-foreground mb-4">
                Your M-Pesa withdrawal is being processed
              </p>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800">
                  <strong>Amount:</strong> KSh {parseFloat(amount).toLocaleString()}<br/>
                  <strong>To:</strong> {recipientName}<br/>
                  <strong>Phone:</strong> {phoneNumber}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6 pt-4">
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-green-900 mb-2">
                Withdrawal Successful!
              </h3>
              <p className="text-muted-foreground">
                KSh {parseFloat(amount).toLocaleString()} has been sent to {phoneNumber}
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MpesaWithdrawForm;