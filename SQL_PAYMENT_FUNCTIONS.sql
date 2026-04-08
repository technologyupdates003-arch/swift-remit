-- Database Functions for Payment Processing (SQL Alternative)
-- Run these in your Supabase SQL Editor

-- Function to update wallet balance after payment
CREATE OR REPLACE FUNCTION public.update_wallet_balance(
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
  result JSON;
BEGIN
  -- Get wallet info
  SELECT * INTO v_wallet FROM public.wallets WHERE id = p_wallet_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Wallet not found');
  END IF;
  
  v_user_id := v_wallet.user_id;
  
  -- Update wallet balance
  UPDATE public.wallets 
  SET balance = balance + p_amount,
      updated_at = now()
  WHERE id = p_wallet_id;
  
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
    v_user_id,
    p_wallet_id,
    'deposit',
    p_amount,
    v_wallet.currency,
    'completed',
    p_reference,
    now()
  );
  
  -- Create payment record
  INSERT INTO public.payments (
    user_id,
    wallet_id,
    paystack_reference,
    amount,
    currency,
    status,
    created_at
  ) VALUES (
    v_user_id,
    p_wallet_id,
    p_reference,
    p_amount,
    v_wallet.currency,
    'success',
    now()
  );
  
  RETURN json_build_object(
    'success', true, 
    'message', 'Wallet updated successfully',
    'new_balance', v_wallet.balance + p_amount
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Function to process withdrawal
CREATE OR REPLACE FUNCTION public.process_withdrawal(
  p_wallet_id UUID,
  p_amount NUMERIC,
  p_bank_account_id UUID,
  p_reference TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet RECORD;
  v_bank_account RECORD;
  v_user_id UUID;
  result JSON;
BEGIN
  -- Get wallet info
  SELECT * INTO v_wallet FROM public.wallets WHERE id = p_wallet_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Wallet not found');
  END IF;
  
  -- Check sufficient balance
  IF v_wallet.balance < p_amount THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient balance');
  END IF;
  
  -- Get bank account info
  SELECT * INTO v_bank_account FROM public.bank_accounts WHERE id = p_bank_account_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Bank account not found');
  END IF;
  
  v_user_id := v_wallet.user_id;
  
  -- Deduct from wallet balance
  UPDATE public.wallets 
  SET balance = balance - p_amount,
      updated_at = now()
  WHERE id = p_wallet_id;
  
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
    v_user_id,
    p_wallet_id,
    'withdrawal',
    p_amount,
    v_wallet.currency,
    'pending',
    p_reference,
    now()
  );
  
  -- Create withdrawal record
  INSERT INTO public.withdrawals (
    user_id,
    wallet_id,
    bank_account_id,
    paystack_reference,
    amount,
    currency,
    status,
    created_at
  ) VALUES (
    v_user_id,
    p_wallet_id,
    p_bank_account_id,
    p_reference,
    p_amount,
    v_wallet.currency,
    'pending',
    now()
  );
  
  RETURN json_build_object(
    'success', true, 
    'message', 'Withdrawal processed successfully',
    'new_balance', v_wallet.balance - p_amount
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Function to verify payment status
CREATE OR REPLACE FUNCTION public.verify_payment_status(
  p_reference TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payment RECORD;
  result JSON;
BEGIN
  -- Get payment info
  SELECT * INTO v_payment FROM public.payments WHERE paystack_reference = p_reference;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Payment not found');
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'payment', row_to_json(v_payment)
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.update_wallet_balance TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_withdrawal TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_payment_status TO authenticated;