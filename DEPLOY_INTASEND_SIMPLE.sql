-- Deploy IntaSend Functions - Simple Version
-- Run this after creating the wallet

-- Create IntaSend transactions table
CREATE TABLE IF NOT EXISTS public.intasend_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  wallet_id UUID REFERENCES public.wallets(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL,
  intasend_transaction_id TEXT,
  amount NUMERIC(20, 6) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'KES',
  phone_number TEXT,
  recipient_name TEXT,
  narrative TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  intasend_response JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.intasend_transactions ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Users can view own intasend transactions" ON public.intasend_transactions;
DROP POLICY IF EXISTS "Users can create intasend transactions" ON public.intasend_transactions;

CREATE POLICY "Users can view own intasend transactions" ON public.intasend_transactions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create intasend transactions" ON public.intasend_transactions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Create IntaSend M-Pesa funding function
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
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not authenticated');
  END IF;
  
  -- Get wallet info
  SELECT * INTO v_wallet FROM public.wallets 
  WHERE id = p_wallet_id AND user_id = v_user_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Wallet not found or access denied');
  END IF;
  
  -- Validate currency
  IF v_wallet.currency != 'KES' THEN
    RETURN json_build_object('success', false, 'error', 'M-Pesa only supports KES wallets');
  END IF;
  
  -- Validate phone number
  IF NOT p_phone_number ~ '^254[0-9]{9}$' THEN
    RETURN json_build_object('success', false, 'error', 'Invalid phone number format. Use 254XXXXXXXXX');
  END IF;
  
  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be greater than 0');
  END IF;
  
  -- Create transaction record
  INSERT INTO public.intasend_transactions (
    user_id, wallet_id, transaction_type, amount, currency, 
    phone_number, narrative, status
  ) VALUES (
    v_user_id, p_wallet_id, 'mpesa_fund', p_amount, 'KES',
    p_phone_number, 'M-Pesa wallet funding', 'pending'
  ) RETURNING id INTO v_transaction_id;
  
  RETURN json_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'message', 'M-Pesa STK push initiated',
    'intasend_payload', json_build_object(
      'transaction_id', v_transaction_id,
      'wallet_id', p_wallet_id,
      'phone_number', p_phone_number,
      'amount', p_amount,
      'currency', 'KES',
      'api_action', 'stk_push'
    )
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Create function to update transaction status
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
  
  -- If funding completed, update wallet balance
  IF v_transaction.transaction_type = 'mpesa_fund' AND p_status = 'completed' THEN
    UPDATE public.wallets 
    SET balance = balance + v_transaction.amount,
        updated_at = now()
    WHERE id = v_transaction.wallet_id;
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.intasend_mpesa_fund_wallet TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_intasend_transaction_status TO authenticated;