-- Fix function permissions and make it accessible via RPC
-- Grant execute permissions to all roles
GRANT EXECUTE ON FUNCTION public.intasend_mpesa_fund_wallet(UUID, TEXT, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.intasend_mpesa_fund_wallet(UUID, TEXT, NUMERIC) TO anon;
GRANT EXECUTE ON FUNCTION public.intasend_mpesa_fund_wallet(UUID, TEXT, NUMERIC) TO service_role;

-- Also grant on all variations of the function signature
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;