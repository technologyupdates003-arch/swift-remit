-- Paystack Frontend + SQL Integration Functions
-- Run this in your Supabase SQL Editor

-- Create Paystack transactions table (if not exists)
CREATE TABLE IF NOT EXISTS public.paystack_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  wallet_id UUID REFERENCES public.wallets(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL, -- 'card_fund', 'bank_withdraw'
  paystack_reference TEXT UNIQUE,
  paystack_transaction_id TEXT,
  amount NUMERIC(20, 6) NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'success', 'failed'
  paystack_response JSONB,
  recipient_code TEXT, -- For transfers
  transfer_code TEXT, -- For transfers
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.paystack_transactions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own paystack transactions" ON public.paystack_transactions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create paystack transactions" ON public.paystack_transactions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own paystack transactions" ON public.paystack_transactions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_paystack_transactions_user_id ON public.paystack_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_paystack_transactions_wallet_id ON public.paystack_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_paystack_transactions_reference ON public.paystack_transactions(paystack_reference);
CREATE INDEX IF NOT EXISTS idx_paystack_transactions_status ON public.paystack_transactions(status);

-- Function to initiate Paystack card funding
CREATE OR REPLACE FUNCTION public.paystack_initiate_card_funding(
  p_wallet_id UUID,
  p_amount NUMERIC,
  p_reference TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet RECORD;
  v_user_id UUID;
  v_transaction_id UUID;
  result JSON;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not authenticated');
  END IF;
  
  -- Get wallet info
  SELECT * INTO v_wallet FROM public.wallets WHERE id = p_wallet_id AND user_id = v_user_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Wallet not found');
  END IF;
  
  -- Validate supported currencies
  IF v_wallet.currency NOT IN ('NGN', 'USD', 'EUR', 'KES', 'GBP', 'ZAR') THEN
    RETURN json_build_object('success', false, 'error', 'Currency not supported by Paystack');
  END IF;
  
  -- Create Paystack transaction record
  INSERT INTO public.paystack_transactions (
    user_id,
    wallet_id,
    transaction_type,
    paystack_reference,
    amount,
    currency,
    status
  ) VALUES (
    v_user_id,
    p_wallet_id,
    'card_fund',
    p_reference,
    p_amount,
    v_wallet.currency,
    'pending'
  ) RETURNING id INTO v_transaction_id;
  
  RETURN json_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'reference', p_reference,
    'wallet_currency', v_wallet.currency,
    'message', 'Card funding transaction created'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Function to complete Paystack card funding
CREATE OR REPLACE FUNCTION public.paystack_complete_card_funding(
  p_reference TEXT,
  p_paystack_response JSONB
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaction RECORD;
  v_wallet RECORD;
  v_amount NUMERIC;
  result JSON;
BEGIN
  -- Get transaction info
  SELECT * INTO v_transaction FROM public.paystack_transactions 
  WHERE paystack_reference = p_reference AND user_id = auth.uid();
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Transaction not found');
  END IF;
  
  -- Get wallet info
  SELECT * INTO v_wallet FROM public.wallets WHERE id = v_transaction.wallet_id;
  
  -- Extract amount from Paystack response (convert from subunit)
  v_amount := (p_paystack_response->>'amount')::NUMERIC / 100.0;
  
  -- Update transaction status
  UPDATE public.paystack_transactions 
  SET status = 'success',
      paystack_response = p_paystack_response,
      paystack_transaction_id = p_paystack_response->>'id',
      updated_at = now()
  WHERE paystack_reference = p_reference;
  
  -- Update wallet balance
  UPDATE public.wallets 
  SET balance = balance + v_amount,
      updated_at = now()
  WHERE id = v_transaction.wallet_id;
  
  -- Create main transaction record
  INSERT INTO public.transactions (
    user_id,
    wallet_id,
    type,
    amount,
    currency,
    status,
    reference,
    created_at
  ) VALUES (
    v_transaction.user_id,
    v_transaction.wallet_id,
    'deposit',
    v_amount,
    v_transaction.currency,
    'completed',
    'PAYSTACK-' || p_reference,
    now()
  );
  
  RETURN json_build_object(
    'success', true,
    'message', 'Card funding completed successfully',
    'amount', v_amount,
    'new_balance', v_wallet.balance + v_amount
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Function to initiate Paystack bank withdrawal
CREATE OR REPLACE FUNCTION public.paystack_initiate_bank_withdrawal(
  p_wallet_id UUID,
  p_amount NUMERIC,
  p_recipient_code TEXT,
  p_reference TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet RECORD;
  v_user_id UUID;
  v_transaction_id UUID;
  result JSON;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not authenticated');
  END IF;
  
  -- Get wallet info
  SELECT * INTO v_wallet FROM public.wallets WHERE id = p_wallet_id AND user_id = v_user_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Wallet not found');
  END IF;
  
  -- Check sufficient balance
  IF v_wallet.balance < p_amount THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient balance');
  END IF;
  
  -- Deduct from wallet balance immediately
  UPDATE public.wallets 
  SET balance = balance - p_amount,
      updated_at = now()
  WHERE id = p_wallet_id;
  
  -- Create Paystack transaction record
  INSERT INTO public.paystack_transactions (
    user_id,
    wallet_id,
    transaction_type,
    paystack_reference,
    amount,
    currency,
    recipient_code,
    status
  ) VALUES (
    v_user_id,
    p_wallet_id,
    'bank_withdraw',
    p_reference,
    p_amount,
    v_wallet.currency,
    p_recipient_code,
    'pending'
  ) RETURNING id INTO v_transaction_id;
  
  -- Create main transaction record
  INSERT INTO public.transactions (
    user_id,
    wallet_id,
    type,
    amount,
    currency,
    status,
    reference,
    created_at
  ) VALUES (
    v_user_id,
    p_wallet_id,
    'withdrawal',
    p_amount,
    v_wallet.currency,
    'pending',
    'PAYSTACK-' || p_reference,
    now()
  );
  
  RETURN json_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'reference', p_reference,
    'message', 'Bank withdrawal initiated',
    'new_balance', v_wallet.balance - p_amount
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Rollback wallet balance on error
  UPDATE public.wallets 
  SET balance = balance + p_amount
  WHERE id = p_wallet_id;
  
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Function to complete Paystack bank withdrawal
CREATE OR REPLACE FUNCTION public.paystack_complete_bank_withdrawal(
  p_reference TEXT,
  p_transfer_code TEXT,
  p_paystack_response JSONB
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaction RECORD;
  result JSON;
BEGIN
  -- Get transaction info
  SELECT * INTO v_transaction FROM public.paystack_transactions 
  WHERE paystack_reference = p_reference AND user_id = auth.uid();
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Transaction not found');
  END IF;
  
  -- Update transaction status
  UPDATE public.paystack_transactions 
  SET status = 'success',
      transfer_code = p_transfer_code,
      paystack_response = p_paystack_response,
      updated_at = now()
  WHERE paystack_reference = p_reference;
  
  -- Update main transaction status
  UPDATE public.transactions 
  SET status = 'completed',
      updated_at = now()
  WHERE reference = 'PAYSTACK-' || p_reference;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Bank withdrawal completed successfully',
    'transfer_code', p_transfer_code
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Function to handle failed Paystack transactions
CREATE OR REPLACE FUNCTION public.paystack_handle_failed_transaction(
  p_reference TEXT,
  p_error_message TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaction RECORD;
  result JSON;
BEGIN
  -- Get transaction info
  SELECT * INTO v_transaction FROM public.paystack_transactions 
  WHERE paystack_reference = p_reference AND user_id = auth.uid();
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Transaction not found');
  END IF;
  
  -- Update transaction status
  UPDATE public.paystack_transactions 
  SET status = 'failed',
      paystack_response = json_build_object('error', p_error_message),
      updated_at = now()
  WHERE paystack_reference = p_reference;
  
  -- If it was a withdrawal, refund the wallet balance
  IF v_transaction.transaction_type = 'bank_withdraw' THEN
    UPDATE public.wallets 
    SET balance = balance + v_transaction.amount,
        updated_at = now()
    WHERE id = v_transaction.wallet_id;
    
    -- Update main transaction status
    UPDATE public.transactions 
    SET status = 'failed',
        updated_at = now()
    WHERE reference = 'PAYSTACK-' || p_reference;
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Transaction marked as failed',
    'refunded', v_transaction.transaction_type = 'bank_withdraw'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.paystack_initiate_card_funding TO authenticated;
GRANT EXECUTE ON FUNCTION public.paystack_complete_card_funding TO authenticated;
GRANT EXECUTE ON FUNCTION public.paystack_initiate_bank_withdrawal TO authenticated;
GRANT EXECUTE ON FUNCTION public.paystack_complete_bank_withdrawal TO authenticated;
GRANT EXECUTE ON FUNCTION public.paystack_handle_failed_transaction TO authenticated;

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at trigger
DROP TRIGGER IF EXISTS update_paystack_transactions_updated_at ON public.paystack_transactions;
CREATE TRIGGER update_paystack_transactions_updated_at 
  BEFORE UPDATE ON public.paystack_transactions 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();