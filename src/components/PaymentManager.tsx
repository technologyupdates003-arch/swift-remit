import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  CreditCard, 
  Building2, 
  Smartphone, 
  Wallet, 
  Plus, 
  Minus, 
  ArrowRightLeft 
} from 'lucide-react';
import PaystackPayment from './PaystackPayment';

interface PaymentManagerProps {
  wallet: {
    id: string;
    currency: string;
    balance: number;
    wallet_number: string;
  };
  onSuccess: () => void;
}

const PaymentManager = ({ wallet, onSuccess }: PaymentManagerProps) => {
  const [activeModal, setActiveModal] = useState<{
    type: 'fund' | 'withdraw' | 'transfer' | null;
    isOpen: boolean;
  }>({ type: null, isOpen: false });

  const handleOpenModal = (type: 'fund' | 'withdraw' | 'transfer') => {
    setActiveModal({ type, isOpen: true });
  };

  const handleCloseModal = () => {
    setActiveModal({ type: null, isOpen: false });
  };

  const handleSuccess = () => {
    onSuccess();
    handleCloseModal();
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

  // Check what methods are available for each action
  const getAvailableFundingMethods = () => {
    const methods = [];
    
    // Paystack card payments
    const paystackCurrencies = ['KES', 'NGN', 'USD', 'EUR'];
    if (paystackCurrencies.includes(wallet.currency)) {
      methods.push('Card');
    }
    
    // IntaSend M-Pesa
    if (wallet.currency === 'KES') {
      methods.push('M-Pesa');
    }
    
    return methods;
  };

  const getAvailableWithdrawalMethods = () => {
    const methods = [];
    
    // Paystack bank withdrawals
    const paystackCurrencies = ['KES', 'NGN', 'USD', 'EUR'];
    if (paystackCurrencies.includes(wallet.currency)) {
      methods.push('Bank');
    }
    
    // IntaSend M-Pesa withdrawals
    if (wallet.currency === 'KES') {
      methods.push('M-Pesa');
    }
    
    return methods;
  };

  const fundingMethods = getAvailableFundingMethods();
  const withdrawalMethods = getAvailableWithdrawalMethods();

  return (
    <div className="space-y-6">
      {/* Current Balance Card */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-100 text-sm">Available Balance</p>
            <p className="text-3xl font-bold">
              {getCurrencySymbol(wallet.currency)}{wallet.balance.toLocaleString()}
            </p>
            <p className="text-blue-100 text-sm mt-1">
              Wallet: {wallet.wallet_number}
            </p>
          </div>
          <Wallet className="w-12 h-12 text-blue-200" />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Fund Wallet */}
        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <Plus className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold">Add Money</h3>
              <p className="text-sm text-muted-foreground">Fund your wallet</p>
            </div>
          </div>
          
          {fundingMethods.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-1 mb-4">
                {fundingMethods.map((method) => (
                  <span 
                    key={method}
                    className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full"
                  >
                    {method}
                  </span>
                ))}
              </div>
              <Button 
                onClick={() => handleOpenModal('fund')}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                Add Money
              </Button>
            </>
          ) : (
            <div className="text-sm text-muted-foreground mb-4">
              No funding methods available for {wallet.currency}
            </div>
          )}
        </div>

        {/* Withdraw Money */}
        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <Minus className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold">Withdraw</h3>
              <p className="text-sm text-muted-foreground">Cash out funds</p>
            </div>
          </div>
          
          {withdrawalMethods.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-1 mb-4">
                {withdrawalMethods.map((method) => (
                  <span 
                    key={method}
                    className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full"
                  >
                    {method}
                  </span>
                ))}
              </div>
              <Button 
                onClick={() => handleOpenModal('withdraw')}
                variant="outline"
                className="w-full border-red-200 text-red-600 hover:bg-red-50"
                disabled={wallet.balance <= 0}
              >
                Withdraw
              </Button>
            </>
          ) : (
            <div className="text-sm text-muted-foreground mb-4">
              No withdrawal methods available for {wallet.currency}
            </div>
          )}
        </div>

        {/* Send Money */}
        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <ArrowRightLeft className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold">Send Money</h3>
              <p className="text-sm text-muted-foreground">Transfer to wallets</p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-1 mb-4">
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
              Wallet Transfer
            </span>
          </div>
          
          <Button 
            onClick={() => handleOpenModal('transfer')}
            variant="outline"
            className="w-full border-blue-200 text-blue-600 hover:bg-blue-50"
            disabled={wallet.balance <= 0}
          >
            Send Money
          </Button>
        </div>
      </div>

      {/* Payment Method Details */}
      <div className="bg-muted/50 rounded-lg p-4">
        <h4 className="font-medium mb-3">Available Payment Methods</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <h5 className="font-medium text-green-700 mb-2">💰 Add Money</h5>
            <ul className="space-y-1 text-muted-foreground">
              {wallet.currency === 'KES' && (
                <>
                  <li>• Debit/Credit Cards (Paystack)</li>
                  <li>• M-Pesa STK Push (IntaSend)</li>
                </>
              )}
              {['NGN', 'USD', 'EUR'].includes(wallet.currency) && (
                <li>• Debit/Credit Cards (Paystack)</li>
              )}
              {fundingMethods.length === 0 && (
                <li className="text-yellow-600">• No methods available for {wallet.currency}</li>
              )}
            </ul>
          </div>
          
          <div>
            <h5 className="font-medium text-red-700 mb-2">💸 Withdraw Money</h5>
            <ul className="space-y-1 text-muted-foreground">
              {wallet.currency === 'KES' && (
                <>
                  <li>• Bank Account (Paystack)</li>
                  <li>• M-Pesa B2C (IntaSend)</li>
                </>
              )}
              {['NGN', 'USD', 'EUR'].includes(wallet.currency) && (
                <li>• Bank Account (Paystack)</li>
              )}
              {withdrawalMethods.length === 0 && (
                <li className="text-yellow-600">• No methods available for {wallet.currency}</li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* Payment Modals */}
      {activeModal.type && (
        <PaystackPayment
          wallet={wallet}
          isOpen={activeModal.isOpen}
          onClose={handleCloseModal}
          onSuccess={handleSuccess}
          mode={activeModal.type}
        />
      )}
    </div>
  );
};

export default PaymentManager;