import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

const PaymentSuccessPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading');
  const [paymentData, setPaymentData] = useState<any>(null);

  useEffect(() => {
    const verifyPayment = async () => {
      const reference = searchParams.get('reference');
      
      if (!reference) {
        setStatus('failed');
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('fund-wallet', {
          body: {
            action: 'verify_payment',
            reference,
          },
        });

        if (error) throw error;

        if (data.success) {
          setStatus('success');
          setPaymentData(data.data);
          toast({
            title: 'Payment Successful',
            description: 'Your wallet has been funded successfully',
          });
        } else {
          setStatus('failed');
          toast({
            title: 'Payment Failed',
            description: 'Payment verification failed',
            variant: 'destructive',
          });
        }
      } catch (error: any) {
        setStatus('failed');
        toast({
          title: 'Verification Error',
          description: error.message || 'Failed to verify payment',
          variant: 'destructive',
        });
      }
    };

    verifyPayment();
  }, [searchParams, toast]);

  const handleContinue = () => {
    navigate('/wallets');
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
          <h2 className="text-xl font-semibold">Verifying Payment...</h2>
          <p className="text-muted-foreground">Please wait while we confirm your payment</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        {status === 'success' ? (
          <>
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-green-600">Payment Successful!</h1>
              <p className="text-muted-foreground">
                Your wallet has been funded successfully
              </p>
              {paymentData && (
                <div className="bg-muted p-4 rounded-lg mt-4">
                  <p className="text-sm">
                    <strong>Amount:</strong> {paymentData.currency} {(paymentData.amount / 100).toLocaleString()}
                  </p>
                  <p className="text-sm">
                    <strong>Reference:</strong> {paymentData.reference}
                  </p>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <XCircle className="w-16 h-16 text-red-500 mx-auto" />
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-red-600">Payment Failed</h1>
              <p className="text-muted-foreground">
                We couldn't process your payment. Please try again.
              </p>
            </div>
          </>
        )}
        
        <Button onClick={handleContinue} className="w-full">
          Continue to Wallets
        </Button>
      </div>
    </div>
  );
};

export default PaymentSuccessPage;