-- Debug Script for Wallet Funding Issue
-- Run these queries one by one in your Supabase SQL Editor

-- 1. Check if you're authenticated
SELECT auth.uid() as current_user_id;

-- 2. Check if your wallets exist
SELECT id, user_id, currency, balance, wallet_number, created_at 
FROM public.wallets 
WHERE user_id = auth.uid();

-- 3. Check if the IntaSend functions exist
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%intasend%';

-- 4. Check if the intasend_transactions table exists
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'intasend_transactions'
ORDER BY ordinal_position;

-- 5. Test the function with a sample wallet ID (replace with your actual wallet ID)
-- First, get your wallet ID from query #2 above, then run:
-- SELECT public.intasend_mpesa_fund_wallet(
--   'your-wallet-id-here'::UUID,
--   '254712345678',
--   100
-- );

-- 6. Check RLS policies on wallets table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'wallets';

-- 7. Check if wallets table has RLS enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'wallets';