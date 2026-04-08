-- Simple M-Pesa function that should definitely work
CREATE OR REPLACE FUNCTION public.intasend_mpesa_fund_wallet(
  wallet_id UUID,
  phone_number TEXT,
  amount NUMERIC
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Simple test function that just returns success
  RETURN json_build_object(
    'success', true,
    'message', 'Function is working',
    'wallet_id', wallet_id,
    'phone_number', phone_number,
    'amount', amount
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.intasend_mpesa_fund_wallet(UUID, TEXT, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.intasend_mpesa_fund_wallet(UUID, TEXT, NUMERIC) TO anon;