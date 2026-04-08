-- IntaSend M-Pesa Integration Functions (With Proper Auth)
-- Run this to replace the previous functions

-- Create IntaSend transactions table (if not exists)
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

-- Enable RLS on intasend_transactions
ALTER TABLE public.intasend_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policy for intasend_transactions
CREATE POLICY "Users can manage their own intasend transactions" ON public.intasend_transactions
FOR ALL USING (
  user_id IN (
    SELECT id FROM public.users WHERE auth_user_id = auth.uid()
  )
);

-- Helper function to get user ID from auth
CREATE OR REPLACE FUNCTION public.get_user_id_from_auth()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- Function to fund wallet via M-Pesa (with auth)
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
  IF p_amount <= 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Amount must be greater than 0'
    );
  END IF;

  -- Get wallet info and validate ownership
  SELECT w.user_id, w.currency
  INTO v_wallet_user_id, v_wallet_currency
  FROM public.wallets w
  WHERE w.id = p_wallet_id AND w.status = 'active';

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

-- Function to get user's wallets
CREATE OR REPLACE FUNCTION public.get_user_wallets()
RETURNS TABLE(
  id UUID,
  currency VARCHAR(3),
  balance DECIMAL(15,2),
  wallet_number VARCHAR(50),
  type VARCHAR(20),
  status VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    w.id,
    w.currency,
    w.balance,
    w.wallet_number,
    w.type,
    w.status,
    w.created_at
  FROM public.wallets w
  JOIN public.users u ON w.user_id = u.id
  WHERE u.auth_user_id = auth.uid()
  ORDER BY w.created_at DESC;
$$;