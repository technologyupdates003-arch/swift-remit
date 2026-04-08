import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CheckCircle, Clock, Building2 } from 'lucide-react';

interface WithdrawalSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  withdrawalData: {
    amount: number;
    currency: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    reference?: string;
  };
}

const WithdrawalSuccessModal = ({ isOpen, onClose, withdrawalData }: WithdrawalSuccessModalProps) => {
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
          <DialogTitle className="text-center">Withdrawal Successful</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 pt-4">
          {/* Success Icon */}
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-green-900">
              {getCurrencySymbol(withdrawalData.currency)}{withdrawalData.amount.toLocaleString()} Sent
            </h3>
            <p className="text-sm text-muted-foreground">
              Your withdrawal has been processed successfully
            </p>
          </div>

          {/* Transaction Details */}
          <div className="bg-muted p-4 rounded-lg space-y-3">
            <h4 className="text-sm font-medium">Transaction Details</h4>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-medium">
                  {getCurrencySymbol(withdrawalData.currency)}{withdrawalData.amount.toLocaleString()}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-muted-foreground">Destination</span>
                <span className="font-medium">{withdrawalData.bankName}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-muted-foreground">Account</span>
                <span className="font-medium">{withdrawalData.accountNumber}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-muted-foreground">Recipient</span>
                <span className="font-medium">{withdrawalData.accountName}</span>
              </div>
              
              {withdrawalData.reference && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reference</span>
                  <span className="font-mono text-xs">{withdrawalData.reference}</span>
                </div>
              )}
            </div>
          </div>

          {/* Timeline Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900">What happens next?</p>
                <div className="text-sm text-blue-800 space-y-1 mt-1">
                  <p>• Your funds are being transferred now</p>
                  <p>• You'll receive the money within 5-30 minutes</p>
                  <p>• Check your bank app or SMS for confirmation</p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <Button onClick={onClose} className="w-full">
            Done
          </Button>

          {/* Support Note */}
          <p className="text-xs text-center text-muted-foreground">
            Need help? Contact our support team if you don't receive your funds within 1 hour.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WithdrawalSuccessModal;