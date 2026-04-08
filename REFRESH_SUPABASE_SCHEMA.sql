-- Force Supabase to refresh its API schema
-- This notifies Supabase that the schema has changed

-- Update the function to trigger schema refresh
ALTER FUNCTION public.intasend_mpesa_fund_wallet(UUID, TEXT, NUMERIC) 
SET search_path = public;

-- Add a comment to force schema update
COMMENT ON FUNCTION public.intasend_mpesa_fund_wallet(UUID, TEXT, NUMERIC) 
IS 'M-Pesa wallet funding via IntaSend - Updated ' || NOW();

-- Revoke and re-grant permissions to trigger refresh
REVOKE EXECUTE ON FUNCTION public.intasend_mpesa_fund_wallet(UUID, TEXT, NUMERIC) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.intasend_mpesa_fund_wallet(UUID, TEXT, NUMERIC) FROM anon;

GRANT EXECUTE ON FUNCTION public.intasend_mpesa_fund_wallet(UUID, TEXT, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.intasend_mpesa_fund_wallet(UUID, TEXT, NUMERIC) TO anon;

-- Force a schema notification
NOTIFY pgrst, 'reload schema';