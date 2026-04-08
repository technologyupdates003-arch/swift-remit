-- Update IntaSend Functions to Use Correct Users Table
-- Run this after fixing the foreign key constraint

-- Drop existing IntaSend transactions table if it has wrong foreign key
DROP TABLE IF EXISTS public.intasend_transactions CASCADE;

-- Create IntaSend transactions table with correct foreign key
CREATE TABLE public.intasend_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  wallet_id UUID REFERENCES public.wallets(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL, -- 'mpesa_fund', 'mpesa_withdraw', 'wallet_transfer'
  intasend_transaction_id TEXT,
  amount NUMERIC(20, 6) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'KES',
  phone_number TEXT,
  recipient_name TEXT,
  narrative TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'failed'
  intasend_response JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.intasend_transactions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own intasend transactions" ON public.intasend_transactions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create intasend transactions" ON public.intasend_transactions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Create indexes
CREATE INDEX idx_intasend_transactions_user_id ON public.intasend_transactions(user_id);
CREATE INDEX idx_intasend_transactions_wallet_id ON public.intasend_transactions(wallet_id);
CREATE INDEX idx_intasend_transactions_status ON public.intasend_transactions(status);

-- Updated IntaSend M-Pesa funding function
CREATE OR REPLACE FUNCTION public.intasend_mpesa_fund_wallet(
  p_wallet_id UUID,
  p_phone_number TEXT,
  p_amount NUMERIC
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet RECORD;
  v_user_id UUID;
  v_transaction_id UUID;
  v_intasend_payload JSONB;
  result JSON;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not authenticated');
  END IF;
  
  -- Get wallet info - check both ID and ownership
  SELECT * INTO v_wallet FROM public.wallets 
  WHERE id = p_wallet_id AND user_id = v_user_id;
  
  IF NOT FOUND THEN
    -- Check if wallet exists but belongs to different user
    PERFORM 1 FROM public.wallets WHERE id = p_wallet_id;
    IF FOUND THEN
      RETURN json_build_object('success', false, 'error', 'Wallet access denied');
    ELSE
      RETURN json_build_object('success', false, 'error', 'Wallet not found');
    END IF;
  END IF;
  
  -- Validate currency (IntaSend M-Pesa only supports KES)
  IF v_wallet.currency != 'KES' THEN
    RETURN json_build_object('success', false, 'error', 'M-Pesa only supports KES wallets');
  END IF;
  
  -- Validate phone number format (254...)
  IF NOT p_phone_number ~ '^254[0-9]{9}$' THEN
    RETURN json_build_object('success', false, 'error', 'Invalid phone number format. Use 254XXXXXXXXX');
  END IF;
  
  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be greater than 0');
  END IF;
  
  -- Create IntaSend transaction record
  INSERT INTO public.intasend_transactions (
    user_id,
    wallet_id,
    transaction_type,
    amount,
    currency,
    phone_number,
    narrative,
    status
  ) VALUES (
    v_user_id,
    p_wallet_id,
    'mpesa_fund',
    p_amount,
    'KES',
    p_phone_number,
    'M-Pesa wallet funding',
    'pending'
  ) RETURNING id INTO v_transaction_id;
  
  -- Prepare IntaSend API payload
  v_intasend_payload := json_build_object(
    'transaction_id', v_transaction_id,
    'wallet_id', p_wallet_id,
    'phone_number', p_phone_number,
    'amount', p_amount,
    'currency', 'KES',
    'api_action', 'stk_push'
  );
  
  RETURN json_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'message', 'M-Pesa STK push initiated',
    'intasend_payload', v_intasend_payload,
    'instructions', 'Check your phone for M-Pesa prompt'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Function to update IntaSend transaction status
CREATE OR REPLACE FUNCTION public.update_intasend_transaction_status(
  p_transaction_id UUID,
  p_status TEXT,
  p_intasend_response JSONB DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaction RECORD;
  v_wallet RECORD;
  result JSON;
BEGIN
  -- Get transaction info
  SELECT * INTO v_transaction FROM public.intasend_transactions WHERE id = p_transaction_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Transaction not found');
  END IF;
  
  -- Update transaction status
  UPDATE public.intasend_transactions 
  SET status = p_status,
      intasend_response = COALESCE(p_intasend_response, intasend_response),
      updated_at = now()
  WHERE id = p_transaction_id;
  
  -- If M-Pesa funding completed, update wallet balance
  IF v_transaction.transaction_type = 'mpesa_fund' AND p_status = 'completed' THEN
    UPDATE public.wallets 
    SET balance = balance + v_transaction.amount,
        updated_at = now()
    WHERE id = v_transaction.wallet_id;
    
    -- Create transaction record in main transactions table
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
      v_transaction.amount,
      v_transaction.currency,
      'completed',
      'MPESA-' || p_transaction_id,
      now()
    );
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Transaction status updated',
    'transaction_id', p_transaction_id,
    'status', p_status
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.intasend_mpesa_fund_wallet TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_intasend_transaction_status TO authenticated;

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_intasend_transactions_updated_at 
  BEFORE UPDATE ON public.intasend_transactions 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();