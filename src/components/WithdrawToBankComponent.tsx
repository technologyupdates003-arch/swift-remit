import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Building2, Shield, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import BankAccountManager from './BankAccountManager';

interface BankAccount {
  id: string;
  account_name: string;
  account_number: string;
  bank_name: string;
  bank_code: string;
  currency: string;
  is_verified: boolean;
  is_default: boolean;
  paystack_recipient_code?: string;
}

interface WithdrawToBankProps {
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

const WithdrawToBankComponent = ({ wallet, isOpen, onClose, onSuccess }: WithdrawToBankProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'form' | 'confirm' | 'processing'>('form');

  // Only support NGN for bank withdrawals
  const isWithdrawalSupported = wallet.currency === 'NGN';

  const handleWithdraw = async () => {
    if (!amount || !selectedAccount || !user) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    const numAmount = parseFloat(amount);
    if (numAmount <= 0 || numAmount > wallet.balance) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter a valid amount within your balance',
        variant: 'destructive',
      });
      return;
    }

    setStep('processing');
    setLoading(true);

    try {
      let recipientCode = selectedAccount.paystack_recipient_code;

      // Create recipient if not exists
      if (!recipientCode) {
        const { data: recipientData, error: recipientError } = await supabase.functions.invoke('withdraw-to-bank', {
          body: {
            action: 'create_recipient',
            name: selectedAccount.account_name,
            account_number: selectedAccount.account_number,
            bank_code: selectedAccount.bank_code,
            currency: 'NGN',
          },
        });

        if (recipientError) throw recipientError;

        if (!recipientData.status) {
          throw new Error(recipientData.message || 'Failed to create recipient');
        }

        recipientCode = recipientData.data.recipient_code;

        // Update bank account with recipient code
        await supabase
          .from('bank_accounts' as any)
          .update({ paystack_recipient_code: recipientCode } as any)
          .eq('id', selectedAccount.id);
      }

      // Initiate transfer
      const { data, error } = await supabase.functions.invoke('withdraw-to-bank', {
        body: {
          action: 'initiate_transfer',
          amount: numAmount,
          recipient_code: recipientCode,
          wallet_id: wallet.id,
          user_id: user.id,
          reason: `Withdrawal from ${wallet.currency} wallet`,
        },
      });

      if (error) throw error;

      if (data.status) {
        toast({
          title: 'Withdrawal Successful',
          description: 'Your funds are being transferred to your bank account',
        });
        onSuccess();
        onClose();
        resetForm();
      } else {
        throw new Error(data.message || 'Withdrawal failed');
      }
    } catch (error: any) {
      toast({
        title: 'Withdrawal Error',
        description: error.message || 'Failed to process withdrawal',
        variant: 'destructive',
      });
      setStep('form');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setAmount('');
    setSelectedAccount(null);
    setStep('form');
    setLoading(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const getCurrencySymbol = (currency: string) => {
    const symbols: Record<string, string> = {
      NGN: '₦',
      USD: '$',
      EUR: '€',
      KES: 'KSh',
    };
    return symbols[currency] || currency;
  };

  const getWithdrawalFee = (amount: number) => {
    // Paystack charges ₦50 for transfers above ₦5,000, ₦10 for below
    return amount >= 5000 ? 50 : 10;
  };

  const numAmount = parseFloat(amount) || 0;
  const fee = getWithdrawalFee(numAmount);
  const totalDeduction = numAmount + fee;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Withdraw to Bank
          </DialogTitle>
        </DialogHeader>
        
        {!isWithdrawalSupported ? (
          <div className="space-y-4 pt-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">Currency Not Supported</p>
                  <p className="text-sm text-yellow-700">
                    Bank withdrawals are only available for NGN wallets. 
                    Please exchange your {wallet.currency} to NGN first.
                  </p>
                </div>
              </div>
            </div>
            <Button onClick={handleClose} className="w-full">
              Close
            </Button>
          </div>
        ) : step === 'form' ? (
          <div className="space-y-6 pt-4">
            {/* Wallet Balance */}
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-4 rounded-lg border border-primary/20">
              <p className="text-sm text-muted-foreground">Available Balance</p>
              <p className="text-2xl font-bold text-primary">
                {getCurrencySymbol(wallet.currency)}{wallet.balance.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">
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
                min="1"
                max={wallet.balance}
                step="0.01"
                className="text-lg font-semibold"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Minimum: {getCurrencySymbol(wallet.currency)}100</span>
                <span>Maximum: {getCurrencySymbol(wallet.currency)}{wallet.balance.toLocaleString()}</span>
              </div>
            </div>

            {/* Fee Breakdown */}
            {numAmount > 0 && (
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <h4 className="text-sm font-medium">Transaction Summary</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Withdrawal Amount</span>
                    <span>{getCurrencySymbol(wallet.currency)}{numAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Processing Fee</span>
                    <span>{getCurrencySymbol(wallet.currency)}{fee}</span>
                  </div>
                  <div className="border-t pt-1 flex justify-between font-medium">
                    <span>Total Deduction</span>
                    <span>{getCurrencySymbol(wallet.currency)}{totalDeduction.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Bank Account Selection */}
            <BankAccountManager
              onAccountSelect={setSelectedAccount}
              selectedAccountId={selectedAccount?.id}
            />

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
                onClick={() => setStep('confirm')}
                className="flex-1"
                disabled={loading || !amount || !selectedAccount || numAmount < 100 || totalDeduction > wallet.balance}
              >
                Continue
              </Button>
            </div>

            {/* Processing Time Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <Clock className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Processing Time</p>
                  <p className="text-sm text-blue-800">
                    Withdrawals are processed instantly. Funds typically arrive in your bank account within 5-30 minutes.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : step === 'confirm' ? (
          <div className="space-y-6 pt-4">
            {/* Confirmation Summary */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-green-900 mb-3">Confirm Withdrawal</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-green-700">Amount to Receive</span>
                  <span className="font-semibold text-green-900">
                    {getCurrencySymbol(wallet.currency)}{numAmount.toLocaleString()}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-sm text-green-700">Processing Fee</span>
                  <span className="text-green-900">
                    {getCurrencySymbol(wallet.currency)}{fee}
                  </span>
                </div>
                
                <div className="border-t border-green-300 pt-2 flex justify-between">
                  <span className="text-sm font-medium text-green-700">Total Deduction</span>
                  <span className="font-bold text-green-900">
                    {getCurrencySymbol(wallet.currency)}{totalDeduction.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Bank Account Details */}
            {selectedAccount && (
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="text-sm font-medium mb-2">Destination Account</h4>
                <div className="space-y-1 text-sm">
                  <p><span className="font-medium">Account Name:</span> {selectedAccount.account_name}</p>
                  <p><span className="font-medium">Bank:</span> {selectedAccount.bank_name}</p>
                  <p><span className="font-medium">Account Number:</span> {selectedAccount.account_number}</p>
                </div>
              </div>
            )}

            {/* Confirmation Buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep('form')}
                className="flex-1"
                disabled={loading}
              >
                Back
              </Button>
              <Button
                onClick={handleWithdraw}
                className="flex-1"
                disabled={loading}
              >
                Confirm Withdrawal
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 pt-4">
            {/* Processing State */}
            <div className="text-center py-8">
              <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <h3 className="text-lg font-semibold mb-2">Processing Withdrawal</h3>
              <p className="text-muted-foreground">
                Please wait while we process your withdrawal to {selectedAccount?.bank_name}
              </p>
            </div>
          </div>
        )}

        {/* Security Notice */}
        {step === 'form' && (
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-2">
            <Shield className="w-4 h-4" />
            <span>All withdrawals are secured and processed instantly</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default WithdrawToBankComponent;