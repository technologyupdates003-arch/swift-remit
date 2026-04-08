-- Fee Calculation and Management Functions

-- 1. Function to calculate fees for any service
CREATE OR REPLACE FUNCTION public.calculate_service_fee(
  p_service_type VARCHAR(50),
  p_amount DECIMAL(15,2),
  p_currency VARCHAR(3) DEFAULT 'KES'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_fee_config RECORD;
  v_calculated_fee DECIMAL(15,2) := 0;
  v_commission DECIMAL(15,2) := 0;
  v_commission_config RECORD;
BEGIN
  -- Get fee configuration
  SELECT * INTO v_fee_config
  FROM public.fee_config
  WHERE service_type = p_service_type
  AND currency = p_currency
  AND is_active = true
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    -- Calculate fee based on type
    IF v_fee_config.fee_type = 'fixed' THEN
      v_calculated_fee := v_fee_config.fee_amount;
    ELSIF v_fee_config.fee_type = 'percentage' THEN
      v_calculated_fee := (p_amount * v_fee_config.fee_amount / 100);
    END IF;

    -- Apply min/max limits
    IF v_fee_config.min_amount IS NOT NULL AND v_calculated_fee < v_fee_config.min_amount THEN
      v_calculated_fee := v_fee_config.min_amount;
    END IF;

    IF v_fee_config.max_amount IS NOT NULL AND v_calculated_fee > v_fee_config.max_amount THEN
      v_calculated_fee := v_fee_config.max_amount;
    END IF;
  END IF;

  -- Get commission configuration
  SELECT * INTO v_commission_config
  FROM public.commission_config
  WHERE service_type = p_service_type
  AND currency = p_currency
  AND is_active = true
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    -- Calculate commission
    IF v_commission_config.commission_type = 'fixed' THEN
      v_commission := v_commission_config.commission_rate;
    ELSIF v_commission_config.commission_type = 'percentage' THEN
      v_commission := (v_calculated_fee * v_commission_config.commission_rate / 100);
    END IF;

    -- Apply commission limits
    IF v_commission_config.min_commission IS NOT NULL AND v_commission < v_commission_config.min_commission THEN
      v_commission := v_commission_config.min_commission;
    END IF;

    IF v_commission_config.max_commission IS NOT NULL AND v_commission > v_commission_config.max_commission THEN
      v_commission := v_commission_config.max_commission;
    END IF;
  END IF;

  RETURN json_build_object(
    'fee_amount', v_calculated_fee,
    'commission_amount', v_commission,
    'total_cost', v_calculated_fee,
    'currency', p_currency,
    'service_type', p_service_type
  );
END;
$$;

-- 2. Function to charge fee and record transaction
CREATE OR REPLACE FUNCTION public.charge_service_fee(
  p_user_id UUID,
  p_wallet_id UUID,
  p_service_type VARCHAR(50),
  p_service_description TEXT,
  p_amount DECIMAL(15,2),
  p_currency VARCHAR(3) DEFAULT 'KES',
  p_reference_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_fee_calc JSON;
  v_fee_amount DECIMAL(15,2);
  v_commission DECIMAL(15,2);
  v_wallet_balance DECIMAL(15,2);
  v_fee_transaction_id UUID;
BEGIN
  -- Calculate fee
  SELECT public.calculate_service_fee(p_service_type, p_amount, p_currency) INTO v_fee_calc;
  
  v_fee_amount := (v_fee_calc->>'fee_amount')::DECIMAL(15,2);
  v_commission := (v_fee_calc->>'commission_amount')::DECIMAL(15,2);

  -- Check wallet balance if wallet_id provided
  IF p_wallet_id IS NOT NULL THEN
    SELECT balance INTO v_wallet_balance
    FROM public.wallets
    WHERE id = p_wallet_id AND user_id = p_user_id;

    IF NOT FOUND THEN
      RETURN json_build_object(
        'success', false,
        'error', 'Wallet not found'
      );
    END IF;

    IF v_wallet_balance < v_fee_amount THEN
      RETURN json_build_object(
        'success', false,
        'error', 'Insufficient balance to pay service fee',
        'required_amount', v_fee_amount,
        'available_balance', v_wallet_balance
      );
    END IF;

    -- Deduct fee from wallet
    UPDATE public.wallets
    SET balance = balance - v_fee_amount,
        updated_at = NOW()
    WHERE id = p_wallet_id;
  END IF;

  -- Record fee transaction
  INSERT INTO public.fee_transactions (
    user_id,
    wallet_id,
    service_type,
    service_description,
    fee_amount,
    commission_amount,
    currency,
    reference_id
  ) VALUES (
    p_user_id,
    p_wallet_id,
    p_service_type,
    p_service_description,
    v_fee_amount,
    v_commission,
    p_currency,
    p_reference_id
  ) RETURNING id INTO v_fee_transaction_id;

  RETURN json_build_object(
    'success', true,
    'fee_transaction_id', v_fee_transaction_id,
    'fee_amount', v_fee_amount,
    'commission_amount', v_commission,
    'currency', p_currency
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Failed to charge service fee: ' || SQLERRM
    );
END;
$$;

-- 3. Function to send SMS with fee charging
CREATE OR REPLACE FUNCTION public.send_sms_with_fee(
  p_user_id UUID,
  p_phone_number VARCHAR(15),
  p_message TEXT,
  p_sms_type VARCHAR(50),
  p_reference_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user RECORD;
  v_sms_fee JSON;
  v_fee_amount DECIMAL(15,2);
  v_wallet_id UUID;
  v_sms_log_id UUID;
BEGIN
  -- Get user details
  SELECT * INTO v_user
  FROM public.users
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;

  -- Calculate SMS fee
  SELECT public.calculate_service_fee('sms', 1, 'KES') INTO v_sms_fee;
  v_fee_amount := (v_sms_fee->>'fee_amount')::DECIMAL(15,2);

  -- Get user's KES wallet for fee deduction
  SELECT id INTO v_wallet_id
  FROM public.wallets
  WHERE user_id = p_user_id AND currency = 'KES' AND status = 'active'
  ORDER BY created_at ASC
  LIMIT 1;

  -- Charge SMS fee if wallet exists
  IF v_wallet_id IS NOT NULL THEN
    PERFORM public.charge_service_fee(
      p_user_id,
      v_wallet_id,
      'sms',
      'SMS: ' || p_sms_type,
      1,
      p_reference_id,
      'KES'
    );
  END IF;

  -- Log SMS (will be sent by Edge Function)
  INSERT INTO public.sms_log (
    user_id,
    phone_number,
    message,
    sms_type,
    cost,
    currency,
    reference_id,
    status
  ) VALUES (
    p_user_id,
    p_phone_number,
    p_message,
    p_sms_type,
    v_fee_amount,
    'KES',
    p_reference_id,
    'pending'
  ) RETURNING id INTO v_sms_log_id;

  RETURN json_build_object(
    'success', true,
    'sms_log_id', v_sms_log_id,
    'fee_charged', v_fee_amount,
    'message', 'SMS queued for sending'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Failed to process SMS: ' || SQLERRM
    );
END;
$$;

-- 4. Function to generate statement with fee
CREATE OR REPLACE FUNCTION public.generate_statement_with_fee(
  p_user_id UUID,
  p_wallet_id UUID,
  p_statement_type VARCHAR(50),
  p_date_from DATE,
  p_date_to DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_auth_user_id UUID;
  v_fee_result JSON;
  v_fee_amount DECIMAL(15,2);
  v_statement_id UUID;
BEGIN
  -- Get authenticated user
  v_auth_user_id := auth.uid();
  
  IF v_auth_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User not authenticated'
    );
  END IF;

  -- Verify user owns the wallet
  IF NOT EXISTS (
    SELECT 1 FROM public.wallets w
    JOIN public.users u ON w.user_id = u.id
    WHERE w.id = p_wallet_id 
    AND u.auth_user_id = v_auth_user_id
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Wallet not found or access denied'
    );
  END IF;

  -- Calculate statement fee
  SELECT public.calculate_service_fee('statement_download', 1, 'KES') INTO v_fee_result;
  v_fee_amount := (v_fee_result->>'fee_amount')::DECIMAL(15,2);

  -- Charge statement fee
  SELECT public.charge_service_fee(
    p_user_id,
    p_wallet_id,
    'statement_download',
    'Statement: ' || p_statement_type || ' (' || p_date_from || ' to ' || p_date_to || ')',
    1,
    NULL,
    'KES'
  ) INTO v_fee_result;

  IF NOT (v_fee_result->>'success')::BOOLEAN THEN
    RETURN v_fee_result;
  END IF;

  -- Create statement download record
  INSERT INTO public.statement_downloads (
    user_id,
    wallet_id,
    statement_type,
    date_from,
    date_to,
    fee_charged,
    currency
  ) VALUES (
    p_user_id,
    p_wallet_id,
    p_statement_type,
    p_date_from,
    p_date_to,
    v_fee_amount,
    'KES'
  ) RETURNING id INTO v_statement_id;

  RETURN json_build_object(
    'success', true,
    'statement_id', v_statement_id,
    'fee_charged', v_fee_amount,
    'message', 'Statement generation initiated'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Failed to generate statement: ' || SQLERRM
    );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.calculate_service_fee(VARCHAR(50), DECIMAL(15,2), VARCHAR(3)) TO authenticated;
GRANT EXECUTE ON FUNCTION public.charge_service_fee(UUID, UUID, VARCHAR(50), TEXT, DECIMAL(15,2), VARCHAR(3), UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_sms_with_fee(UUID, VARCHAR(15), TEXT, VARCHAR(50), UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_statement_with_fee(UUID, UUID, VARCHAR(50), DATE, DATE) TO authenticated;