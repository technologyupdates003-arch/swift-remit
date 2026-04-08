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
import { Building2, Copy, CheckCircle, Clock } from 'lucide-react';

interface BankTransferFormProps {
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

const BankTransferForm = ({ wallet, isOpen, onClose, onSuccess }: BankTransferFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [transferDetails, setTransferDetails] = useState<any>(null);

  // Only support NGN for bank transfers
  const isBankTransferSupported = wallet.currency === 'NGN';

  const handleInitiateTransfer = async () => {
    if (!amount || !user) {
      toast({
        title: 'Missing Information',
        description: 'Please enter an amount',
        variant: 'destructive',
      });
      return;
    }

    const numAmount = parseFloat(amount);
    if (numAmount <= 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter a valid amount',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // Get user profile for email
      const { data: profile } = await supabase
        .from('users')
        .select('email, phone, full_name')
        .eq('id', user.id)
        .single();

      if (!profile?.email && !profile?.phone) {
        toast({
          title: 'Profile Incomplete',
          description: 'Please update your profile with email or phone number',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // Initialize payment with Paystack for bank transfer
      const { data, error } = await supabase.functions.invoke('fund-wallet', {
        body: {
          action: 'initialize_payment',
          email: profile.email || `${profile.phone}@swiftremit.com`,
          amount: numAmount,
          currency: wallet.currency,
          wallet_id: wallet.id,
          user_id: user.id,
          channels: ['bank'],
          callback_url: `${window.location.origin}/payment-success`,
        },
      });

      if (error) throw error;

      if (data.status) {
        // Set transfer details for display
        setTransferDetails({
          reference: data.data.reference,
          amount: numAmount,
          currency: wallet.currency,
          account_number: '0123456789', // This would come from Paystack
          bank_name: 'Providus Bank', // This would come from Paystack
          account_name: 'Swift Remit Collections',
        });

        toast({
          title: 'Transfer Details Generated',
          description: 'Use the bank details below to complete your payment',
        });
      } else {
        throw new Error(data.message || 'Failed to generate transfer details');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate transfer details',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: 'Copied!',
        description: `${label} copied to clipboard`,
      });
    });
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Fund Wallet via Bank Transfer
          </DialogTitle>
        </DialogHeader>
        
        {!isBankTransferSupported ? (
          <div className="space-y-4 pt-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                Bank transfers are only available for NGN wallets. 
                Please use card payment for {wallet.currency} wallets.
              </p>
            </div>
            <Button onClick={onClose} className="w-full">
              Close
            </Button>
          </div>
        ) : !transferDetails ? (
          <div className="space-y-6 pt-4">
            {/* Amount Input */}
            <div className="space-y-2">
              <Label htmlFor="amount">Amount ({getCurrencySymbol(wallet.currency)})</Label>
              <Input
                id="amount"
                type="number"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="1"
                step="0.01"
                className="text-lg"
              />
            </div>

            {/* Current Balance */}
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Current Balance: {getCurrencySymbol(wallet.currency)}{wallet.balance.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">
                Wallet: {wallet.wallet_number}
              </p>
            </div>

            {/* Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <Clock className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Bank Transfer Process</p>
                  <p className="text-sm text-blue-800">
                    We'll generate unique bank details for your transfer. 
                    Your wallet will be credited automatically once payment is confirmed.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1"
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleInitiateTransfer}
                className="flex-1"
                disabled={loading || !amount}
              >
                {loading ? 'Generating...' : 'Generate Bank Details'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 pt-4">
            {/* Transfer Details */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-green-600">
                <CheckCircle className="w-4 h-4" />
                Bank Details Generated
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-green-900">Bank Name</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-green-800">{transferDetails.bank_name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(transferDetails.bank_name, 'Bank name')}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-green-900">Account Number</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-green-800">{transferDetails.account_number}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(transferDetails.account_number, 'Account number')}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-green-900">Account Name</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-green-800">{transferDetails.account_name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(transferDetails.account_name, 'Account name')}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                <div className="border-t border-green-300 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-green-900">Amount to Transfer</span>
                    <span className="text-lg font-bold text-green-800">
                      {getCurrencySymbol(transferDetails.currency)}{transferDetails.amount.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-green-900">Reference</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-green-800">{transferDetails.reference}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(transferDetails.reference, 'Reference')}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-900 mb-2">Transfer Instructions</h4>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>Use your bank app or visit any branch</li>
                <li>Transfer the exact amount to the account above</li>
                <li>Use the reference code for the transfer description</li>
                <li>Your wallet will be credited within 5-10 minutes</li>
              </ol>
            </div>

            {/* Action Button */}
            <Button onClick={onClose} className="w-full">
              I've Made the Transfer
            </Button>

            <div className="text-xs text-muted-foreground text-center">
              Keep this page open until your transfer is confirmed
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BankTransferForm;