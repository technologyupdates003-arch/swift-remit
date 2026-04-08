import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CreditCard, Building2, Smartphone, Wallet, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import CardPaymentForm from './CardPaymentForm';
import BankTransferForm from './BankTransferForm';
import MpesaPaymentForm from './MpesaPaymentForm';
import MpesaWithdrawForm from './MpesaWithdrawForm';
import WalletTransferForm from './WalletTransferForm';

interface PaystackPaymentProps {
  wallet: {
    id: string;
    currency: string;
    balance: number;
    wallet_number: string;
  };
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  mode?: 'fund' | 'withdraw' | 'transfer'; // New prop to determine the mode
}

const PaystackPayment = ({ wallet, isOpen, onClose, onSuccess, mode = 'fund' }: PaystackPaymentProps) => {
  const { user } = useAuth();
  const [selectedMethod, setSelectedMethod] = useState<'card' | 'bank' | 'mpesa' | 'mpesa_withdraw' | 'wallet_transfer' | null>(null);

  // Define available methods based on mode and currency
  const getFundingMethods = () => {
    const methods = [];
    
    // Paystack card payments (white-labeled)
    const paystackCurrencies = ['KES', 'NGN', 'USD', 'EUR'];
    if (paystackCurrencies.includes(wallet.currency)) {
      methods.push({
        key: 'card' as const,
        icon: CreditCard,
        title: 'Debit/Credit Card',
        description: 'Pay instantly with your card',
        supported: true,
        provider: 'Paystack'
      });
    }
    
    // IntaSend M-Pesa funding (KES only)
    if (wallet.currency === 'KES') {
      methods.push({
        key: 'mpesa' as const,
        icon: Smartphone,
        title: 'M-Pesa',
        description: 'Pay with Safaricom M-Pesa',
        supported: true,
        provider: 'IntaSend'
      });
    }
    
    return methods;
  };

  const getWithdrawalMethods = () => {
    const methods = [];
    
    // Paystack bank withdrawals
    const paystackCurrencies = ['KES', 'NGN', 'USD', 'EUR'];
    if (paystackCurrencies.includes(wallet.currency)) {
      methods.push({
        key: 'bank' as const,
        icon: Building2,
        title: 'Bank Account',
        description: 'Withdraw to your bank account',
        supported: true,
        provider: 'Paystack'
      });
    }
    
    // IntaSend M-Pesa withdrawals (KES only)
    if (wallet.currency === 'KES') {
      methods.push({
        key: 'mpesa_withdraw' as const,
        icon: Smartphone,
        title: 'M-Pesa',
        description: 'Send to any M-Pesa number',
        supported: true,
        provider: 'IntaSend'
      });
    }
    
    return methods;
  };

  const getTransferMethods = () => {
    return [{
      key: 'wallet_transfer' as const,
      icon: Wallet,
      title: 'Wallet Transfer',
      description: 'Send to another Swift Remit wallet',
      supported: true,
      provider: 'Swift Remit'
    }];
  };

  const getAvailableMethods = () => {
    switch (mode) {
      case 'fund':
        return getFundingMethods();
      case 'withdraw':
        return getWithdrawalMethods();
      case 'transfer':
        return getTransferMethods();
      default:
        return getFundingMethods();
    }
  };

  const availableMethods = getAvailableMethods();

  const handleMethodSelect = (method: 'card' | 'bank' | 'mpesa' | 'mpesa_withdraw' | 'wallet_transfer') => {
    setSelectedMethod(method);
  };

  const handleBack = () => {
    setSelectedMethod(null);
  };

  const handleClose = () => {
    setSelectedMethod(null);
    onClose();
  };

  const getCurrencySymbol = (currency: string) => {
    const symbols: Record<string, string> = {
      KES: 'KSh',
      USD: '$',
      EUR: '€',
      NGN: '₦',
    };
    return symbols[currency] || currency;
  };

  const getModalTitle = () => {
    switch (mode) {
      case 'fund':
        return `Fund ${wallet.currency} Wallet`;
      case 'withdraw':
        return `Withdraw from ${wallet.currency} Wallet`;
      case 'transfer':
        return 'Send Money';
      default:
        return `Fund ${wallet.currency} Wallet`;
    }
  };

  const getModalDescription = () => {
    switch (mode) {
      case 'fund':
        return 'Choose your preferred payment method to add funds to your wallet';
      case 'withdraw':
        return 'Choose how you want to receive your money';
      case 'transfer':
        return 'Send money to another wallet or phone number';
      default:
        return 'Choose your preferred payment method to add funds to your wallet';
    }
  };

  // If a specific method is selected, show that form
  if (selectedMethod === 'card') {
    return (
      <CardPaymentForm
        wallet={wallet}
        isOpen={isOpen}
        onClose={handleClose}
        onSuccess={onSuccess}
      />
    );
  }

  if (selectedMethod === 'bank') {
    return (
      <BankTransferForm
        wallet={wallet}
        isOpen={isOpen}
        onClose={handleClose}
        onSuccess={onSuccess}
      />
    );
  }

  if (selectedMethod === 'mpesa') {
    return (
      <MpesaPaymentForm
        wallet={wallet}
        isOpen={isOpen}
        onClose={handleClose}
        onSuccess={onSuccess}
      />
    );
  }

  if (selectedMethod === 'mpesa_withdraw') {
    return (
      <MpesaWithdrawForm
        wallet={wallet}
        isOpen={isOpen}
        onClose={handleClose}
        onSuccess={onSuccess}
      />
    );
  }

  if (selectedMethod === 'wallet_transfer') {
    return (
      <WalletTransferForm
        wallet={wallet}
        isOpen={isOpen}
        onClose={handleClose}
        onSuccess={onSuccess}
      />
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{getModalTitle()}</DialogTitle>
          <DialogDescription>
            {getModalDescription()}
          </DialogDescription>
        </DialogHeader>
        
        {availableMethods.length === 0 ? (
          <div className="space-y-4 pt-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                No payment methods available for {wallet.currency} wallets in {mode} mode.
              </p>
            </div>
            <Button onClick={handleClose} className="w-full">
              Close
            </Button>
          </div>
        ) : (
          <div className="space-y-6 pt-4">
            {/* Current Balance */}
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">Current Balance</p>
              <p className="text-2xl font-bold">
                {getCurrencySymbol(wallet.currency)}{wallet.balance.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">
                Wallet: {wallet.wallet_number}
              </p>
            </div>

            {/* Payment Methods */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-foreground">
                {mode === 'fund' ? 'Choose Payment Method' : 
                 mode === 'withdraw' ? 'Choose Withdrawal Method' : 
                 'Choose Transfer Method'}
              </h3>
              
              {availableMethods.map((method) => (
                <button
                  key={method.key}
                  onClick={() => method.supported && handleMethodSelect(method.key)}
                  disabled={!method.supported}
                  className={`w-full flex items-center gap-4 p-4 rounded-lg border transition-colors text-left ${
                    method.supported
                      ? 'border-border bg-card hover:border-primary hover:bg-primary/5'
                      : 'border-border bg-muted opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    method.supported ? 'bg-primary/10' : 'bg-muted'
                  }`}>
                    <method.icon className={`w-6 h-6 ${
                      method.supported ? 'text-primary' : 'text-muted-foreground'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{method.title}</p>
                      <span className="text-xs bg-muted px-2 py-1 rounded-full text-muted-foreground">
                        {method.provider}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {method.supported ? method.description : 'Not available for this currency'}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            {/* Cancel Button */}
            <Button variant="outline" onClick={handleClose} className="w-full">
              Cancel
            </Button>

            {/* Security Notice */}
            <div className="text-xs text-muted-foreground text-center">
              All transactions are secured with bank-level encryption
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PaystackPayment;