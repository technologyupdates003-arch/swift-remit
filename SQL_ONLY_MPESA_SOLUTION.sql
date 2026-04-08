-- Complete SQL-Only M-Pesa Solution (No Edge Functions Required)
-- This creates a system that works entirely within PostgreSQL

-- 1. Create M-Pesa requests table to store payment requests
CREATE TABLE IF NOT EXISTS public.mpesa_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  phone_number VARCHAR(15) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'KES',
  request_id VARCHAR(100) UNIQUE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'completed', 'failed'
  instructions TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.mpesa_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Users can manage their own mpesa requests" ON public.mpesa_requests
FOR ALL USING (
  user_id IN (
    SELECT id FROM public.users WHERE auth_user_id = auth.uid()
  )
);

-- 2. Create function to initiate M-Pesa request (SQL-only)
CREATE OR REPLACE FUNCTION public.mpesa_fund_wallet_sql_only(
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
  v_request_id VARCHAR(100);
  v_instructions TEXT;
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

  -- Generate unique request ID
  v_request_id := 'MPESA-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 8)) || '-' || EXTRACT(EPOCH FROM NOW())::bigint;

  -- Create M-Pesa payment instructions
  v_instructions := format(
    'To complete your payment:
1. Go to M-Pesa on your phone
2. Select "Lipa na M-Pesa"
3. Select "Buy Goods and Services"
4. Enter Till Number: 123456
5. Enter Amount: %s
6. Enter your M-Pesa PIN
7. Confirm payment

Reference: %s
Phone: %s

Once payment is complete, your wallet will be credited automatically.',
    amount::text,
    v_request_id,
    phone_number
  );

  -- Create M-Pesa request record
  INSERT INTO public.mpesa_requests (
    user_id,
    wallet_id,
    phone_number,
    amount,
    currency,
    request_id,
    status,
    instructions
  ) VALUES (
    v_user_id,
    wallet_id,
    phone_number,
    amount,
    v_wallet_currency,
    v_request_id,
    'pending',
    v_instructions
  );

  -- Also create transaction record for tracking
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
  );

  -- Return success with payment instructions
  RETURN json_build_object(
    'success', true,
    'request_id', v_request_id,
    'wallet_id', wallet_id,
    'amount', amount,
    'currency', v_wallet_currency,
    'phone_number', phone_number,
    'status', 'pending',
    'instructions', v_instructions,
    'message', 'M-Pesa payment instructions generated. Follow the steps to complete payment.'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Database error: ' || SQLERRM
    );
END;
$$;

-- 3. Function to manually complete M-Pesa payment (for admin or webhook)
CREATE OR REPLACE FUNCTION public.complete_mpesa_payment(
  request_id TEXT,
  mpesa_transaction_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request RECORD;
BEGIN
  -- Get the M-Pesa request
  SELECT * INTO v_request
  FROM public.mpesa_requests
  WHERE request_id = complete_mpesa_payment.request_id
  AND status = 'pending';

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'M-Pesa request not found or already processed'
    );
  END IF;

  -- Update wallet balance
  UPDATE public.wallets
  SET 
    balance = balance + v_request.amount,
    updated_at = NOW()
  WHERE id = v_request.wallet_id;

  -- Update M-Pesa request status
  UPDATE public.mpesa_requests
  SET 
    status = 'completed',
    updated_at = NOW()
  WHERE id = v_request.id;

  -- Update transaction status
  UPDATE public.intasend_transactions
  SET 
    status = 'completed',
    intasend_transaction_id = mpesa_transaction_id,
    updated_at = NOW()
  WHERE wallet_id = v_request.wallet_id
  AND user_id = v_request.user_id
  AND amount = v_request.amount
  AND status = 'pending'
  AND transaction_type = 'fund';

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
    v_request.wallet_id,
    v_request.amount,
    v_request.currency,
    'deposit',
    'completed',
    'M-Pesa funding - Request ID: ' || request_id
  );

  RETURN json_build_object(
    'success', true,
    'message', 'M-Pesa payment completed successfully',
    'request_id', request_id,
    'amount', v_request.amount,
    'wallet_id', v_request.wallet_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Database error: ' || SQLERRM
    );
END;
$$;

-- 4. Function to get user's M-Pesa requests
CREATE OR REPLACE FUNCTION public.get_user_mpesa_requests()
RETURNS TABLE(
  id UUID,
  request_id VARCHAR(100),
  phone_number VARCHAR(15),
  amount DECIMAL(15,2),
  currency VARCHAR(3),
  status VARCHAR(20),
  instructions TEXT,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    r.id,
    r.request_id,
    r.phone_number,
    r.amount,
    r.currency,
    r.status,
    r.instructions,
    r.created_at
  FROM public.mpesa_requests r
  JOIN public.users u ON r.user_id = u.id
  WHERE u.auth_user_id = auth.uid()
  ORDER BY r.created_at DESC;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.mpesa_fund_wallet_sql_only(UUID, TEXT, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_mpesa_payment(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_mpesa_requests() TO authenticated;