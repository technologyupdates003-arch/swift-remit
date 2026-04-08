-- IntaSend + Paystack Hybrid Payment Integration (SQL Functions)
-- Run this in your Supabase SQL Editor

-- Create IntaSend transactions table
CREATE TABLE IF NOT EXISTS public.intasend_transactions (
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
  USING (user_id = public.get_user_id_from_auth());

CREATE POLICY "Users can create intasend transactions" ON public.intasend_transactions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.get_user_id_from_auth());

-- Create indexes
CREATE INDEX idx_intasend_transactions_user_id ON public.intasend_transactions(user_id);
CREATE INDEX idx_intasend_transactions_wallet_id ON public.intasend_transactions(wallet_id);
CREATE INDEX idx_intasend_transactions_status ON public.intasend_transactions(status);

-- Function to initiate M-Pesa funding
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
  -- Get wallet info
  SELECT * INTO v_wallet FROM public.wallets WHERE id = p_wallet_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Wallet not found');
  END IF;
  
  -- Validate currency (IntaSend M-Pesa only supports KES)
  IF v_wallet.currency != 'KES' THEN
    RETURN json_build_object('success', false, 'error', 'M-Pesa only supports KES wallets');
  END IF;
  
  -- Validate phone number format (254...)
  IF NOT p_phone_number ~ '^254[0-9]{9}$' THEN
    RETURN json_build_object('success', false, 'error', 'Invalid phone number format. Use 254XXXXXXXXX');
  END IF;
  
  v_user_id := v_wallet.user_id;
  
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

-- Function to process M-Pesa withdrawal
CREATE OR REPLACE FUNCTION public.intasend_mpesa_withdraw(
  p_wallet_id UUID,
  p_phone_number TEXT,
  p_amount NUMERIC,
  p_recipient_name TEXT
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
  -- Get wallet info
  SELECT * INTO v_wallet FROM public.wallets WHERE id = p_wallet_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Wallet not found');
  END IF;
  
  -- Validate currency
  IF v_wallet.currency != 'KES' THEN
    RETURN json_build_object('success', false, 'error', 'M-Pesa withdrawals only support KES wallets');
  END IF;
  
  -- Check sufficient balance (including fees)
  IF v_wallet.balance < (p_amount + 10) THEN -- Assuming 10 KES fee
    RETURN json_build_object('success', false, 'error', 'Insufficient balance (including fees)');
  END IF;
  
  -- Validate phone number format
  IF NOT p_phone_number ~ '^254[0-9]{9}$' THEN
    RETURN json_build_object('success', false, 'error', 'Invalid phone number format. Use 254XXXXXXXXX');
  END IF;
  
  v_user_id := v_wallet.user_id;
  
  -- Deduct from wallet balance immediately
  UPDATE public.wallets 
  SET balance = balance - p_amount - 10, -- Include fee
      updated_at = now()
  WHERE id = p_wallet_id;
  
  -- Create IntaSend transaction record
  INSERT INTO public.intasend_transactions (
    user_id,
    wallet_id,
    transaction_type,
    amount,
    currency,
    phone_number,
    recipient_name,
    narrative,
    status
  ) VALUES (
    v_user_id,
    p_wallet_id,
    'mpesa_withdraw',
    p_amount,
    'KES',
    p_phone_number,
    p_recipient_name,
    'M-Pesa withdrawal',
    'pending'
  ) RETURNING id INTO v_transaction_id;
  
  -- Create transaction record
  INSERT INTO public.transactions (
    user_id,
    wallet_id,
    type,
    amount,
    fee,
    currency,
    status,
    reference,
    created_at
  ) VALUES (
    v_user_id,
    p_wallet_id,
    'withdrawal',
    p_amount,
    10,
    'KES',
    'pending',
    'INTASEND-' || v_transaction_id,
    now()
  );
  
  -- Prepare IntaSend B2C payload
  v_intasend_payload := json_build_object(
    'transaction_id', v_transaction_id,
    'transactions', json_build_array(
      json_build_object(
        'name', p_recipient_name,
        'account', p_phone_number,
        'amount', p_amount,
        'narrative', 'Wallet withdrawal'
      )
    ),
    'currency', 'KES',
    'requires_approval', 'NO',
    'api_action', 'mpesa_b2c'
  );
  
  RETURN json_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'message', 'M-Pesa withdrawal initiated',
    'intasend_payload', v_intasend_payload,
    'new_balance', v_wallet.balance - p_amount - 10
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Rollback wallet balance on error
  UPDATE public.wallets 
  SET balance = balance + p_amount + 10
  WHERE id = p_wallet_id;
  
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Function for wallet-to-wallet transfers
CREATE OR REPLACE FUNCTION public.intasend_wallet_transfer(
  p_from_wallet_id UUID,
  p_to_wallet_number TEXT,
  p_amount NUMERIC,
  p_narrative TEXT DEFAULT 'Wallet transfer'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_from_wallet RECORD;
  v_to_wallet RECORD;
  v_from_user_id UUID;
  v_to_user_id UUID;
  v_transaction_id UUID;
  result JSON;
BEGIN
  -- Get sender wallet info
  SELECT * INTO v_from_wallet FROM public.wallets WHERE id = p_from_wallet_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Sender wallet not found');
  END IF;
  
  -- Get receiver wallet info
  SELECT * INTO v_to_wallet FROM public.wallets WHERE wallet_number = p_to_wallet_number;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Receiver wallet not found');
  END IF;
  
  -- Check same currency
  IF v_from_wallet.currency != v_to_wallet.currency THEN
    RETURN json_build_object('success', false, 'error', 'Currency mismatch between wallets');
  END IF;
  
  -- Check sufficient balance
  IF v_from_wallet.balance < p_amount THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient balance');
  END IF;
  
  -- Prevent self-transfer
  IF v_from_wallet.id = v_to_wallet.id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot transfer to same wallet');
  END IF;
  
  v_from_user_id := v_from_wallet.user_id;
  v_to_user_id := v_to_wallet.user_id;
  
  -- Update wallet balances
  UPDATE public.wallets 
  SET balance = balance - p_amount,
      updated_at = now()
  WHERE id = p_from_wallet_id;
  
  UPDATE public.wallets 
  SET balance = balance + p_amount,
      updated_at = now()
  WHERE id = v_to_wallet.id;
  
  -- Create IntaSend transaction record
  INSERT INTO public.intasend_transactions (
    user_id,
    wallet_id,
    transaction_type,
    amount,
    currency,
    narrative,
    status,
    intasend_response
  ) VALUES (
    v_from_user_id,
    p_from_wallet_id,
    'wallet_transfer',
    p_amount,
    v_from_wallet.currency,
    p_narrative,
    'completed',
    json_build_object(
      'to_wallet_id', v_to_wallet.id,
      'to_wallet_number', p_to_wallet_number,
      'to_user_id', v_to_user_id
    )
  ) RETURNING id INTO v_transaction_id;
  
  -- Create sender transaction record
  INSERT INTO public.transactions (
    user_id,
    wallet_id,
    sender_wallet_id,
    receiver_wallet_id,
    sender_user_id,
    receiver_user_id,
    type,
    amount,
    currency,
    status,
    reference,
    created_at
  ) VALUES (
    v_from_user_id,
    p_from_wallet_id,
    p_from_wallet_id,
    v_to_wallet.id,
    v_from_user_id,
    v_to_user_id,
    'transfer',
    p_amount,
    v_from_wallet.currency,
    'completed',
    'TRANSFER-' || v_transaction_id,
    now()
  );
  
  -- Create receiver transaction record
  INSERT INTO public.transactions (
    user_id,
    wallet_id,
    sender_wallet_id,
    receiver_wallet_id,
    sender_user_id,
    receiver_user_id,
    type,
    amount,
    currency,
    status,
    reference,
    created_at
  ) VALUES (
    v_to_user_id,
    v_to_wallet.id,
    p_from_wallet_id,
    v_to_wallet.id,
    v_from_user_id,
    v_to_user_id,
    'deposit',
    p_amount,
    v_from_wallet.currency,
    'completed',
    'TRANSFER-' || v_transaction_id,
    now()
  );
  
  RETURN json_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'message', 'Transfer completed successfully',
    'from_balance', v_from_wallet.balance - p_amount,
    'to_wallet', p_to_wallet_number,
    'amount', p_amount,
    'currency', v_from_wallet.currency
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Rollback on error
  UPDATE public.wallets 
  SET balance = balance + p_amount
  WHERE id = p_from_wallet_id;
  
  UPDATE public.wallets 
  SET balance = balance - p_amount
  WHERE id = v_to_wallet.id;
  
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
    
    -- Create transaction record
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
  
  -- Update main transaction status if exists
  UPDATE public.transactions 
  SET status = CASE 
    WHEN p_status = 'completed' THEN 'completed'
    WHEN p_status = 'failed' THEN 'failed'
    ELSE 'pending'
  END,
  updated_at = now()
  WHERE reference LIKE '%' || p_transaction_id || '%';
  
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
GRANT EXECUTE ON FUNCTION public.intasend_mpesa_withdraw TO authenticated;
GRANT EXECUTE ON FUNCTION public.intasend_wallet_transfer TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_intasend_transaction_status TO authenticated;

-- Add updated_at trigger
CREATE TRIGGER update_intasend_transactions_updated_at 
  BEFORE UPDATE ON public.intasend_transactions 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();