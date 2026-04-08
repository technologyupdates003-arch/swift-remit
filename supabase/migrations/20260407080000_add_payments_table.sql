-- Create payment_status enum
CREATE TYPE public.payment_status AS ENUM ('pending', 'success', 'failed', 'cancelled');

-- Create payments table to track Paystack transactions
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  paystack_reference TEXT NOT NULL UNIQUE,
  paystack_transaction_id TEXT,
  amount NUMERIC(20, 6) NOT NULL,
  currency TEXT NOT NULL,
  status public.payment_status NOT NULL DEFAULT 'pending',
  payment_method TEXT,
  gateway_response TEXT,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own payments" ON public.payments
  FOR SELECT TO authenticated
  USING (user_id = public.get_user_id_from_auth());

CREATE POLICY "Users can create own payments" ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.get_user_id_from_auth());

CREATE POLICY "Admins can view all payments" ON public.payments
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Create indexes
CREATE INDEX idx_payments_user_id ON public.payments(user_id);
CREATE INDEX idx_payments_wallet_id ON public.payments(wallet_id);
CREATE INDEX idx_payments_reference ON public.payments(paystack_reference);
CREATE INDEX idx_payments_status ON public.payments(status);

-- Add updated_at trigger
CREATE TRIGGER update_payments_updated_at 
  BEFORE UPDATE ON public.payments 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();