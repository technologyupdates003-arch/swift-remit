-- Create function with a different name to bypass cache issues
CREATE OR REPLACE FUNCTION public.fund_wallet_mpesa(
  wallet_id UUID,
  phone_number TEXT,
  amount NUMERIC
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_auth_user_id UUID;
  v_wallet_currency VARCHAR(3);
  v_wallet_user_id UUID;
  v_transaction_id UUID;
BEGIN
  -- Get authenticated user ID
  v_auth_user_id := auth.uid();
  
  IF v_auth_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User not authenticated'
    );
  END IF;

  -- Get user ID from public.users
  SELECT id INTO v_user_id
  FROM public.users 
  WHERE auth_user_id = v_auth_user_id;

  IF v_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User profile not found'
    );
  END IF;

  -- Validate inputs
  IF amount <= 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Amount must be greater than 0'
    );
  END IF;

  -- Get wallet info and validate ownership
  SELECT w.user_id, w.currency
  INTO v_wallet_user_id, v_wallet_currency
  FROM public.wallets w
  WHERE w.id = wallet_id AND w.status = 'active';

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Wallet not found or inactive'
    );
  END IF;

  -- Check wallet ownership
  IF v_wallet_user_id != v_user_id THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Wallet does not belong to authenticated user'
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
    wallet_id,
    v_user_id,
    phone_number,
    amount,
    v_wallet_currency,
    'fund',
    'pending'
  ) RETURNING id INTO v_transaction_id;

  -- Return success
  RETURN json_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'wallet_id', wallet_id,
    'amount', amount,
    'currency', v_wallet_currency,
    'phone_number', phone_number,
    'status', 'pending',
    'message', 'M-Pesa funding request created successfully'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Database error: ' || SQLERRM
    );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.fund_wallet_mpesa(UUID, TEXT, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fund_wallet_mpesa(UUID, TEXT, NUMERIC) TO anon;