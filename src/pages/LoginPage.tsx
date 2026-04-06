import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Banknote, Phone, KeyRound } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const LoginPage = () => {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const { login, verifyOtp } = useAuth();
  const { toast } = useToast();

  const handleSendOtp = async () => {
    if (!phone || phone.length < 9) {
      toast({ title: 'Invalid phone number', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const result = await login(phone);
    setLoading(false);
    if (result.success) {
      setStep('otp');
      toast({ title: 'OTP sent to your phone' });
    } else {
      toast({ title: result.message, variant: 'destructive' });
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length < 4) {
      toast({ title: 'Please enter valid OTP', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const result = await verifyOtp(phone, otp);
    setLoading(false);
    if (!result.success) {
      toast({ title: result.message, variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto">
            <Banknote className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">AbanRemit</h1>
          <p className="text-muted-foreground text-sm">Send money anywhere, anytime</p>
        </div>

        {step === 'phone' ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="tel"
                  placeholder="+254712345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Button onClick={handleSendOtp} disabled={loading} className="w-full">
              {loading ? 'Sending OTP...' : 'Send OTP'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Enter OTP</label>
              <p className="text-xs text-muted-foreground">Sent to {phone}</p>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  maxLength={6}
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  className="pl-10 text-center text-lg tracking-widest"
                />
              </div>
            </div>
            <Button onClick={handleVerifyOtp} disabled={loading} className="w-full">
              {loading ? 'Verifying...' : 'Verify & Login'}
            </Button>
            <button
              onClick={() => { setStep('phone'); setOtp(''); }}
              className="w-full text-sm text-primary hover:underline"
            >
              Change phone number
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
