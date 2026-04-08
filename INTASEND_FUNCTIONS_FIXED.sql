-- IntaSend M-Pesa Integration Functions (Fixed for public.users)
-- Run this after fixing the wallet foreign key constraint

-- Create IntaSend transactions table
CREATE TABLE IF NOT EXISTS public.intasend_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  phone_number VARCHAR(15) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'KES',
  transaction_type VARCHAR(20) NOT NULL, -- 'fund', 'withdraw'
  intasend_transaction_id VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'failed'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_intasend_transactions_wallet_id ON public.intasend_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_intasend_transactions_user_id ON public.intasend_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_intasend_transactions_status ON public.intasend_transactions(status);

-- Function to fund wallet via M-Pesa
CREATE OR REPLACE FUNCTION public.intasend_mpesa_fund_wallet(
  p_wallet_id UUID,
  p_phone_number VARCHAR(15),
  p_amount DECIMAL(15,2)
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_wallet_currency VARCHAR(3);
  v_transaction_id UUID;
  v_result JSON;
BEGIN
  -- Validate inputs
  IF p_amount <= 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Amount must be greater than 0'
    );
  END IF;

  -- Get wallet info and validate ownership
  SELECT w.user_id, w.currency
  INTO v_user_id, v_wallet_currency
  FROM public.wallets w
  WHERE w.id = p_wallet_id AND w.status = 'active';

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Wallet not found or inactive'
    );
  END IF;

  -- Ensure currency is KES for M-Pesa
  IF v_wallet_currency != 'KES' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'M-Pesa funding only available for KES wallets'
    );
  END IF;

  -- Create transaction record
  INSERT INTO public.intasend_transactions (
    wallet_id,
    user_id,
    phone_number,
    amount,
    currency,
    transaction_type,
    status
  ) VALUES (
    p_wallet_id,
    v_user_id,
    p_phone_number,
    p_amount,
    v_wallet_currency,
    'fund',
    'pending'
  ) RETURNING id INTO v_transaction_id;

  -- Return success with transaction details
  RETURN json_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'wallet_id', p_wallet_id,
    'amount', p_amount,
    'currency', v_wallet_currency,
    'phone_number', p_phone_number,
    'status', 'pending',
    'message', 'M-Pesa funding request created. You will receive an STK push shortly.'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Database error: ' || SQLERRM
    );
END;
$$;

-- Function to complete M-Pesa funding (called by webhook)
CREATE OR REPLACE FUNCTION public.complete_intasend_funding(
  p_transaction_id UUID,
  p_intasend_id VARCHAR(100),
  p_status VARCHAR(20)
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_id UUID;
  v_amount DECIMAL(15,2);
  v_currency VARCHAR(3);
BEGIN
  -- Get transaction details
  SELECT wallet_id, amount, currency
  INTO v_wallet_id, v_amount, v_currency
  FROM public.intasend_transactions
  WHERE id = p_transaction_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Transaction not found or already processed'
    );
  END IF;

  -- Update transaction status
  UPDATE public.intasend_transactions
  SET 
    intasend_transaction_id = p_intasend_id,
    status = p_status,
    updated_at = NOW()
  WHERE id = p_transaction_id;

  -- If successful, update wallet balance
  IF p_status = 'completed' THEN
    UPDATE public.wallets
    SET 
      balance = balance + v_amount,
      updated_at = NOW()
    WHERE id = v_wallet_id;

    -- Create transaction record
    INSERT INTO public.transactions (
      from_wallet_id,
      to_wallet_id,
      amount,
      currency,
      transaction_type,
      status,
      description
    ) VALUES (
      NULL, -- External funding
      v_wallet_id,
      v_amount,
      v_currency,
      'deposit',
      'completed',
      'M-Pesa funding via IntaSend'
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'transaction_id', p_transaction_id,
    'status', p_status,
    'wallet_updated', (p_status = 'completed')
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Database error: ' || SQLERRM
    );
END;
$$;

-- Function to withdraw to M-Pesa
CREATE OR REPLACE FUNCTION public.intasend_mpesa_withdraw(
  p_wallet_id UUID,
  p_phone_number VARCHAR(15),
  p_amount DECIMAL(15,2),
  p_pin_hash VARCHAR(64)
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_wallet_balance DECIMAL(15,2);
  v_wallet_currency VARCHAR(3);
  v_stored_pin_hash VARCHAR(64);
  v_transaction_id UUID;
BEGIN
  -- Validate inputs
  IF p_amount <= 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Amount must be greater than 0'
    );
  END IF;

  -- Get wallet info and validate ownership
  SELECT w.user_id, w.balance, w.currency, u.pin_hash
  INTO v_user_id, v_wallet_balance, v_wallet_currency, v_stored_pin_hash
  FROM public.wallets w
  JOIN public.users u ON w.user_id = u.id
  WHERE w.id = p_wallet_id AND w.status = 'active';

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Wallet not found or inactive'
    );
  END IF;

  -- Verify PIN
  IF v_stored_pin_hash IS NULL OR v_stored_pin_hash != p_pin_hash THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid PIN'
    );
  END IF;

  -- Check sufficient balance
  IF v_wallet_balance < p_amount THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Insufficient balance'
    );
  END IF;

  -- Ensure currency is KES for M-Pesa
  IF v_wallet_currency != 'KES' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'M-Pesa withdrawal only available for KES wallets'
    );
  END IF;

  -- Deduct amount from wallet
  UPDATE public.wallets
  SET 
    balance = balance - p_amount,
    updated_at = NOW()
  WHERE id = p_wallet_id;

  -- Create transaction record
  INSERT INTO public.intasend_transactions (
    wallet_id,
    user_id,
    phone_number,
    amount,
    currency,
    transaction_type,
    status
  ) VALUES (
    p_wallet_id,
    v_user_id,
    p_phone_number,
    p_amount,
    v_wallet_currency,
    'withdraw',
    'pending'
  ) RETURNING id INTO v_transaction_id;

  -- Create withdrawal transaction
  INSERT INTO public.transactions (
    from_wallet_id,
    to_wallet_id,
    amount,
    currency,
    transaction_type,
    status,
    description
  ) VALUES (
    p_wallet_id,
    NULL, -- External withdrawal
    p_amount,
    v_wallet_currency,
    'withdrawal',
    'pending',
    'M-Pesa withdrawal via IntaSend'
  );

  RETURN json_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'wallet_id', p_wallet_id,
    'amount', p_amount,
    'currency', v_wallet_currency,
    'phone_number', p_phone_number,
    'status', 'pending',
    'message', 'Withdrawal request submitted. Funds will be sent to your M-Pesa shortly.'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Database error: ' || SQLERRM
    );
END;
$$;