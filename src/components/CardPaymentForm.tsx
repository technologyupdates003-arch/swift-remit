import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { paystackService } from '@/lib/paystack';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CreditCard, Lock, Shield, ArrowLeft } from 'lucide-react';
import './card-styles.css';

interface CardPaymentFormProps {
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

const CardPaymentForm = ({ wallet, isOpen, onClose, onSuccess }: CardPaymentFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [cardData, setCardData] = useState({
    number: '',
    expiry: '',
    cvv: '',
    name: '',
  });

  // Supported currencies for Paystack
  const supportedCurrencies = ['KES', 'NGN', 'USD', 'EUR'];
  const isPaystackSupported = supportedCurrencies.includes(wallet.currency);

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    if (parts.length) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  const formatExpiry = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
  };

  const getCardType = (number: string) => {
    const num = number.replace(/\s/g, '');
    if (/^4/.test(num)) return 'visa';
    if (/^5[1-5]/.test(num)) return 'mastercard';
    if (/^3[47]/.test(num)) return 'amex';
    if (/^506/.test(num)) return 'verve';
    return 'card';
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCardNumber(e.target.value);
    if (formatted.length <= 19) { // 16 digits + 3 spaces
      setCardData(prev => ({ ...prev, number: formatted }));
    }
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatExpiry(e.target.value);
    if (formatted.length <= 5) { // MM/YY
      setCardData(prev => ({ ...prev, expiry: formatted }));
    }
  };

  const handleCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    if (value.length <= 4) {
      setCardData(prev => ({ ...prev, cvv: value }));
    }
  };

  const validateCard = () => {
    const { number, expiry, cvv, name } = cardData;
    const cleanNumber = number.replace(/\s/g, '');
    
    if (!name.trim()) return 'Cardholder name is required';
    if (cleanNumber.length < 13 || cleanNumber.length > 19) return 'Invalid card number';
    if (!expiry.includes('/') || expiry.length !== 5) return 'Invalid expiry date';
    if (cvv.length < 3) return 'Invalid CVV';
    if (!amount || parseFloat(amount) <= 0) return 'Invalid amount';
    
    const [month, year] = expiry.split('/');
    const currentDate = new Date();
    const expiryDate = new Date(2000 + parseInt(year), parseInt(month) - 1);
    
    if (expiryDate < currentDate) return 'Card has expired';
    
    return null;
  };

  const handlePayment = async () => {
    const validationError = validateCard();
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

      const userEmail = profile.email || `${profile.phone}@swiftremit.com`;
      const reference = paystackService.generateReference('CARD');
      
      // Step 1: Create transaction record in database
      const { data: dbResult, error: dbError } = await supabase.rpc('paystack_initiate_card_funding', {
        p_wallet_id: wallet.id,
        p_amount: parseFloat(amount),
        p_reference: reference
      });

      if (dbError) throw dbError;

      if (!dbResult.success) {
        throw new Error(dbResult.error);
      }

      // Step 2: Initialize payment with Paystack
      const paymentData = await paystackService.initializePayment({
        email: userEmail,
        amount: paystackService.convertToSubunit(parseFloat(amount), wallet.currency),
        currency: wallet.currency,
        reference: reference,
        metadata: {
          wallet_id: wallet.id,
          user_id: user.id,
          purpose: 'wallet_funding'
        }
      });

      if (!paymentData.status) {
        throw new Error(paymentData.message || 'Failed to initialize payment');
      }

      // Step 3: Use Paystack Inline for seamless payment
      const PaystackPop = (window as any).PaystackPop;
      
      if (!PaystackPop) {
        // Fallback to redirect if inline not available
        window.location.href = paymentData.data.authorization_url;
        return;
      }

      const handler = PaystackPop.setup({
        key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
        email: userEmail,
        amount: paystackService.convertToSubunit(parseFloat(amount), wallet.currency),
        currency: wallet.currency,
        ref: reference,
        metadata: {
          wallet_id: wallet.id,
          user_id: user.id,
          purpose: 'wallet_funding'
        },
        callback: async function(response: any) {
          try {
            // Step 4: Verify payment with Paystack
            const verificationResult = await paystackService.verifyPayment(response.reference);
            
            if (verificationResult.status && verificationResult.data.status === 'success') {
              // Step 5: Complete funding in database
              await supabase.rpc('paystack_complete_card_funding', {
                p_reference: response.reference,
                p_paystack_response: verificationResult.data
              });

              toast({
                title: 'Payment Successful',
                description: `${getCurrencySymbol(wallet.currency)}${parseFloat(amount).toLocaleString()} added to your wallet`,
              });
              
              onSuccess();
              onClose();
            } else {
              throw new Error('Payment verification failed');
            }
          } catch (error: any) {
            // Handle failed payment
            await supabase.rpc('paystack_handle_failed_transaction', {
              p_reference: response.reference,
              p_error_message: error.message
            });

            toast({
              title: 'Payment Failed',
              description: error.message || 'Payment could not be completed',
              variant: 'destructive',
            });
          }
        },
        onClose: function() {
          // Payment cancelled
          toast({
            title: 'Payment Cancelled',
            description: 'Payment was cancelled',
            variant: 'destructive',
          });
        }
      });

      handler.openIframe();
      
    } catch (error: any) {
      toast({
        title: 'Payment Error',
        description: error.message || 'Failed to process payment',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
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

  // Load Paystack inline script
  useEffect(() => {
    if (isOpen && !document.getElementById('paystack-inline')) {
      const script = document.createElement('script');
      script.id = 'paystack-inline';
      script.src = 'https://js.paystack.co/v1/inline.js';
      script.async = true;
      document.head.appendChild(script);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            Pay with Card
          </DialogTitle>
          <DialogDescription>
            Enter your card details to fund your wallet securely
          </DialogDescription>
        </DialogHeader>
        
        {!isPaystackSupported ? (
          <div className="space-y-4 pt-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                Card payments are not available for {wallet.currency} wallets. 
                Supported currencies: KES, NGN, USD, EUR
              </p>
            </div>
            <Button onClick={onClose} className="w-full">
              Close
            </Button>
          </div>
        ) : (
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
                className="text-lg font-semibold"
              />
            </div>

            {/* Card Preview */}
            {(cardData.number || cardData.name || cardData.expiry) && (
              <div className="card-preview">
                <div className="card-chip"></div>
                <div className="card-number">
                  {cardData.number || '•••• •••• •••• ••••'}
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <div className="text-xs opacity-75 mb-1">CARDHOLDER</div>
                    <div className="card-holder">
                      {cardData.name || 'YOUR NAME'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs opacity-75 mb-1">EXPIRES</div>
                    <div className="card-expiry">
                      {cardData.expiry || 'MM/YY'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Card Details */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Lock className="w-4 h-4" />
                Card Details
              </div>

              {/* Cardholder Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Cardholder Name</Label>
                <Input
                  id="name"
                  placeholder="John Doe"
                  value={cardData.name}
                  onChange={(e) => setCardData(prev => ({ ...prev, name: e.target.value.toUpperCase() }))}
                />
              </div>

              {/* Card Number */}
              <div className="space-y-2">
                <Label htmlFor="number">Card Number</Label>
                <div className="relative">
                  <Input
                    id="number"
                    placeholder="1234 5678 9012 3456"
                    value={cardData.number}
                    onChange={handleCardNumberChange}
                    className={`pr-12 card-input card-number-input ${getCardType(cardData.number) !== 'card' ? `card-type-${getCardType(cardData.number)}` : ''}`}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <CreditCard className={`w-5 h-5 ${
                      getCardType(cardData.number) === 'visa' ? 'text-blue-600' : 
                      getCardType(cardData.number) === 'mastercard' ? 'text-red-600' : 
                      getCardType(cardData.number) === 'verve' ? 'text-green-600' : 
                      getCardType(cardData.number) === 'amex' ? 'text-blue-700' : 'text-gray-400'
                    }`} />
                  </div>
                </div>
              </div>

              {/* Expiry and CVV */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expiry">Expiry Date</Label>
                  <Input
                    id="expiry"
                    placeholder="MM/YY"
                    value={cardData.expiry}
                    onChange={handleExpiryChange}
                    className="card-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cvv">CVV</Label>
                  <Input
                    id="cvv"
                    placeholder="123"
                    value={cardData.cvv}
                    onChange={handleCvvChange}
                    type="password"
                    className="card-input"
                  />
                </div>
              </div>
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
                onClick={handlePayment}
                className="flex-1"
                disabled={loading || !amount || !cardData.name || !cardData.number || !cardData.expiry || !cardData.cvv}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full loading-spinner"></div>
                    Processing...
                  </div>
                ) : (
                  `Pay ${getCurrencySymbol(wallet.currency)}${amount || '0'}`
                )}
              </Button>
            </div>

            {/* Security Notice */}
            <div className="payment-security-badge mx-auto">
              <Shield className="w-4 h-4" />
              <span>Secured by 256-bit SSL encryption</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CardPaymentForm;