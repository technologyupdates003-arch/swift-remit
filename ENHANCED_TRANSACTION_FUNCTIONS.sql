-- Enhanced Transaction Functions with Fees and SMS Notifications

-- 1. Enhanced wallet transfer with fees and SMS
CREATE OR REPLACE FUNCTION public.transfer_with_fees_and_sms(
  p_from_wallet_id UUID,
  p_to_wallet_id UUID,
  p_amount DECIMAL(15,2),
  p_pin_hash VARCHAR(64),
  p_description TEXT DEFAULT 'Wallet transfer'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_auth_user_id UUID;
  v_user_id UUID;
  v_from_wallet RECORD;
  v_to_wallet RECORD;
  v_to_user RECORD;
  v_fee_result JSON;
  v_fee_amount DECIMAL(15,2);
  v_transaction_id UUID;
  v_sms_result JSON;
BEGIN
  -- Get authenticated user
  v_auth_user_id := auth.uid();
  
  IF v_auth_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not authenticated');
  END IF;

  -- Get user ID
  SELECT id INTO v_user_id FROM public.users WHERE auth_user_id = v_auth_user_id;

  -- Get wallet details and verify ownership
  SELECT w.*, u.pin_hash, u.phone INTO v_from_wallet
  FROM public.wallets w
  JOIN public.users u ON w.user_id = u.id
  WHERE w.id = p_from_wallet_id AND u.auth_user_id = v_auth_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Source wallet not found');
  END IF;

  -- Verify PIN
  IF v_from_wallet.pin_hash IS NULL OR v_from_wallet.pin_hash != p_pin_hash THEN
    RETURN json_build_object('success', false, 'error', 'Invalid PIN');
  END IF;

  -- Get destination wallet
  SELECT w.*, u.phone, u.full_name INTO v_to_wallet
  FROM public.wallets w
  JOIN public.users u ON w.user_id = u.id
  WHERE w.id = p_to_wallet_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Destination wallet not found');
  END IF;

  -- Check currency match
  IF v_from_wallet.currency != v_to_wallet.currency THEN
    RETURN json_build_object('success', false, 'error', 'Currency mismatch');
  END IF;

  -- Calculate transfer fee
  SELECT public.calculate_service_fee('transaction', p_amount, v_from_wallet.currency) INTO v_fee_result;
  v_fee_amount := (v_fee_result->>'fee_amount')::DECIMAL(15,2);

  -- Check sufficient balance (amount + fee)
  IF v_from_wallet.balance < (p_amount + v_fee_amount) THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Insufficient balance',
      'required', p_amount + v_fee_amount,
      'available', v_from_wallet.balance,
      'fee', v_fee_amount
    );
  END IF;

  -- Perform transfer
  -- Deduct from source wallet (amount + fee)
  UPDATE public.wallets 
  SET balance = balance - p_amount - v_fee_amount, updated_at = NOW()
  WHERE id = p_from_wallet_id;

  -- Add to destination wallet
  UPDATE public.wallets 
  SET balance = balance + p_amount, updated_at = NOW()
  WHERE id = p_to_wallet_id;

  -- Create transaction record
  INSERT INTO public.transactions (
    from_wallet_id, to_wallet_id, amount, currency, 
    transaction_type, status, description
  ) VALUES (
    p_from_wallet_id, p_to_wallet_id, p_amount, v_from_wallet.currency,
    'transfer', 'completed', p_description
  ) RETURNING id INTO v_transaction_id;

  -- Charge transfer fee
  PERFORM public.charge_service_fee(
    v_user_id, p_from_wallet_id, 'transaction',
    'Transfer fee: ' || p_description, p_amount, 'KES', v_transaction_id
  );

  -- Send SMS notifications
  -- SMS to sender
  IF v_from_wallet.phone IS NOT NULL THEN
    SELECT public.send_sms_with_fee(
      v_user_id,
      v_from_wallet.phone,
      'Transfer sent: ' || v_from_wallet.currency || ' ' || p_amount || ' to ' || v_to_wallet.full_name || '. Fee: ' || v_fee_amount || '. Ref: ' || v_transaction_id,
      'transaction',
      v_transaction_id
    ) INTO v_sms_result;
  END IF;

  -- SMS to recipient
  IF v_to_wallet.phone IS NOT NULL THEN
    SELECT public.send_sms_with_fee(
      v_to_wallet.user_id,
      v_to_wallet.phone,
      'Money received: ' || v_from_wallet.currency || ' ' || p_amount || ' from ' || v_from_wallet.full_name || '. Ref: ' || v_transaction_id,
      'transaction',
      v_transaction_id
    ) INTO v_sms_result;
  END IF;

  RETURN json_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'amount_transferred', p_amount,
    'fee_charged', v_fee_amount,
    'currency', v_from_wallet.currency,
    'message', 'Transfer completed successfully'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Transfer failed: ' || SQLERRM);
END;
$$;

-- 2. Enhanced currency exchange with fees
CREATE OR REPLACE FUNCTION public.exchange_currency_with_fees(
  p_from_wallet_id UUID,
  p_to_wallet_id UUID,
  p_from_amount DECIMAL(15,2),
  p_exchange_rate DECIMAL(15,6),
  p_pin_hash VARCHAR(64)
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_auth_user_id UUID;
  v_user_id UUID;
  v_from_wallet RECORD;
  v_to_wallet RECORD;
  v_to_amount DECIMAL(15,2);
  v_fee_result JSON;
  v_fee_amount DECIMAL(15,2);
  v_transaction_id UUID;
BEGIN
  -- Get authenticated user
  v_auth_user_id := auth.uid();
  
  IF v_auth_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not authenticated');
  END IF;

  -- Get user ID
  SELECT id INTO v_user_id FROM public.users WHERE auth_user_id = v_auth_user_id;

  -- Get wallet details
  SELECT w.*, u.pin_hash, u.phone INTO v_from_wallet
  FROM public.wallets w
  JOIN public.users u ON w.user_id = u.id
  WHERE w.id = p_from_wallet_id AND u.auth_user_id = v_auth_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Source wallet not found');
  END IF;

  -- Verify PIN
  IF v_from_wallet.pin_hash IS NULL OR v_from_wallet.pin_hash != p_pin_hash THEN
    RETURN json_build_object('success', false, 'error', 'Invalid PIN');
  END IF;

  -- Get destination wallet (must be same user)
  SELECT * INTO v_to_wallet
  FROM public.wallets
  WHERE id = p_to_wallet_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Destination wallet not found');
  END IF;

  -- Calculate exchange amount
  v_to_amount := p_from_amount * p_exchange_rate;

  -- Calculate exchange fee
  SELECT public.calculate_service_fee('currency_exchange', p_from_amount, v_from_wallet.currency) INTO v_fee_result;
  v_fee_amount := (v_fee_result->>'fee_amount')::DECIMAL(15,2);

  -- Check sufficient balance
  IF v_from_wallet.balance < (p_from_amount + v_fee_amount) THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Insufficient balance',
      'required', p_from_amount + v_fee_amount,
      'available', v_from_wallet.balance
    );
  END IF;

  -- Perform exchange
  UPDATE public.wallets 
  SET balance = balance - p_from_amount - v_fee_amount, updated_at = NOW()
  WHERE id = p_from_wallet_id;

  UPDATE public.wallets 
  SET balance = balance + v_to_amount, updated_at = NOW()
  WHERE id = p_to_wallet_id;

  -- Create transaction record
  INSERT INTO public.transactions (
    from_wallet_id, to_wallet_id, amount, currency, 
    transaction_type, status, description
  ) VALUES (
    p_from_wallet_id, p_to_wallet_id, p_from_amount, v_from_wallet.currency,
    'exchange', 'completed', 
    'Currency exchange: ' || p_from_amount || ' ' || v_from_wallet.currency || ' to ' || v_to_amount || ' ' || v_to_wallet.currency
  ) RETURNING id INTO v_transaction_id;

  -- Charge exchange fee
  PERFORM public.charge_service_fee(
    v_user_id, p_from_wallet_id, 'currency_exchange',
    'Exchange fee: ' || v_from_wallet.currency || ' to ' || v_to_wallet.currency, 
    p_from_amount, v_from_wallet.currency, v_transaction_id
  );

  -- Send SMS notification
  IF v_from_wallet.phone IS NOT NULL THEN
    PERFORM public.send_sms_with_fee(
      v_user_id,
      v_from_wallet.phone,
      'Currency exchange: ' || p_from_amount || ' ' || v_from_wallet.currency || ' to ' || v_to_amount || ' ' || v_to_wallet.currency || '. Fee: ' || v_fee_amount || '. Ref: ' || v_transaction_id,
      'transaction',
      v_transaction_id
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'from_amount', p_from_amount,
    'to_amount', v_to_amount,
    'exchange_rate', p_exchange_rate,
    'fee_charged', v_fee_amount,
    'from_currency', v_from_wallet.currency,
    'to_currency', v_to_wallet.currency
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Exchange failed: ' || SQLERRM);
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.transfer_with_fees_and_sms(UUID, UUID, DECIMAL(15,2), VARCHAR(64), TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.exchange_currency_with_fees(UUID, UUID, DECIMAL(15,2), DECIMAL(15,6), VARCHAR(64)) TO authenticated;