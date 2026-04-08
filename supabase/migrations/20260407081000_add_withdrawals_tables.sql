-- Create withdrawal_status enum
CREATE TYPE public.withdrawal_status AS ENUM ('pending', 'success', 'failed', 'cancelled');

-- Create bank_accounts table for storing user bank details
CREATE TABLE public.bank_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  account_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  bank_code TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  paystack_recipient_code TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, account_number, bank_code)
);

-- Create withdrawals table to track bank withdrawals
CREATE TABLE public.withdrawals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  bank_account_id UUID REFERENCES public.bank_accounts(id),
  paystack_transfer_code TEXT,
  paystack_reference TEXT NOT NULL UNIQUE,
  amount NUMERIC(20, 6) NOT NULL,
  currency TEXT NOT NULL,
  recipient_code TEXT,
  status public.withdrawal_status NOT NULL DEFAULT 'pending',
  failure_reason TEXT,
  transferred_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

-- Create policies for bank_accounts
CREATE POLICY "Users can view own bank accounts" ON public.bank_accounts
  FOR SELECT TO authenticated
  USING (user_id = public.get_user_id_from_auth());

CREATE POLICY "Users can create own bank accounts" ON public.bank_accounts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.get_user_id_from_auth());

CREATE POLICY "Users can update own bank accounts" ON public.bank_accounts
  FOR UPDATE TO authenticated
  USING (user_id = public.get_user_id_from_auth());

CREATE POLICY "Users can delete own bank accounts" ON public.bank_accounts
  FOR DELETE TO authenticated
  USING (user_id = public.get_user_id_from_auth());

-- Create policies for withdrawals
CREATE POLICY "Users can view own withdrawals" ON public.withdrawals
  FOR SELECT TO authenticated
  USING (user_id = public.get_user_id_from_auth());

CREATE POLICY "Users can create own withdrawals" ON public.withdrawals
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.get_user_id_from_auth());

-- Admin policies
CREATE POLICY "Admins can view all bank accounts" ON public.bank_accounts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all withdrawals" ON public.withdrawals
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update withdrawals" ON public.withdrawals
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Create indexes
CREATE INDEX idx_bank_accounts_user_id ON public.bank_accounts(user_id);
CREATE INDEX idx_bank_accounts_account_number ON public.bank_accounts(account_number);
CREATE INDEX idx_withdrawals_user_id ON public.withdrawals(user_id);
CREATE INDEX idx_withdrawals_wallet_id ON public.withdrawals(wallet_id);
CREATE INDEX idx_withdrawals_reference ON public.withdrawals(paystack_reference);
CREATE INDEX idx_withdrawals_status ON public.withdrawals(status);

-- Add updated_at triggers
CREATE TRIGGER update_bank_accounts_updated_at 
  BEFORE UPDATE ON public.bank_accounts 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_withdrawals_updated_at 
  BEFORE UPDATE ON public.withdrawals 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to ensure only one default bank account per user
CREATE OR REPLACE FUNCTION public.ensure_single_default_bank_account()
RETURNS TRIGGER AS $
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.bank_accounts 
    SET is_default = false 
    WHERE user_id = NEW.user_id AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_default_bank_account_trigger
  BEFORE INSERT OR UPDATE ON public.bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_single_default_bank_account();