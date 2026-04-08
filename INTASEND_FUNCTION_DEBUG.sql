-- Debug version of IntaSend M-Pesa funding function
-- Run this in your Supabase SQL Editor to replace the existing function

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
  
  -- Debug: Log the user ID
  RAISE NOTICE 'Current user ID: %', v_user_id;
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'User not authenticated',
      'debug_info', json_build_object(
        'auth_uid', v_user_id,
        'wallet_id', p_wallet_id
      )
    );
  END IF;
  
  -- Debug: Log the wallet lookup
  RAISE NOTICE 'Looking for wallet ID: % for user: %', p_wallet_id, v_user_id;
  
  -- Get wallet info with more detailed error handling
  SELECT * INTO v_wallet 
  FROM public.wallets 
  WHERE id = p_wallet_id;
  
  -- Check if wallet exists at all
  IF NOT FOUND THEN
    -- Check if wallet exists but belongs to different user
    PERFORM 1 FROM public.wallets WHERE id = p_wallet_id;
    
    IF FOUND THEN
      RETURN json_build_object(
        'success', false, 
        'error', 'Wallet belongs to different user',
        'debug_info', json_build_object(
          'wallet_id', p_wallet_id,
          'current_user', v_user_id,
          'wallet_exists', true
        )
      );
    ELSE
      RETURN json_build_object(
        'success', false, 
        'error', 'Wallet not found in database',
        'debug_info', json_build_object(
          'wallet_id', p_wallet_id,
          'current_user', v_user_id,
          'wallet_exists', false
        )
      );
    END IF;
  END IF;
  
  -- Check if wallet belongs to current user
  IF v_wallet.user_id != v_user_id THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Wallet access denied - ownership mismatch',
      'debug_info', json_build_object(
        'wallet_id', p_wallet_id,
        'wallet_owner', v_wallet.user_id,
        'current_user', v_user_id
      )
    );
  END IF;
  
  -- Debug: Log wallet info
  RAISE NOTICE 'Found wallet: % Currency: % Balance: %', v_wallet.id, v_wallet.currency, v_wallet.balance;
  
  -- Validate currency (IntaSend M-Pesa only supports KES)
  IF v_wallet.currency != 'KES' THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'M-Pesa only supports KES wallets',
      'debug_info', json_build_object(
        'wallet_currency', v_wallet.currency,
        'required_currency', 'KES'
      )
    );
  END IF;
  
  -- Validate phone number format (254...)
  IF NOT p_phone_number ~ '^254[0-9]{9}$' THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Invalid phone number format. Use 254XXXXXXXXX',
      'debug_info', json_build_object(
        'provided_phone', p_phone_number,
        'expected_format', '254XXXXXXXXX'
      )
    );
  END IF;
  
  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Amount must be greater than 0',
      'debug_info', json_build_object(
        'provided_amount', p_amount
      )
    );
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
  
  -- Debug: Log transaction creation
  RAISE NOTICE 'Created transaction: %', v_transaction_id;
  
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
    'instructions', 'Check your phone for M-Pesa prompt',
    'debug_info', json_build_object(
      'wallet_found', true,
      'user_id', v_user_id,
      'wallet_id', p_wallet_id,
      'wallet_currency', v_wallet.currency,
      'wallet_balance', v_wallet.balance
    )
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false, 
    'error', SQLERRM,
    'debug_info', json_build_object(
      'sql_state', SQLSTATE,
      'error_detail', SQLERRM,
      'user_id', v_user_id,
      'wallet_id', p_wallet_id
    )
  );
END;
$$;