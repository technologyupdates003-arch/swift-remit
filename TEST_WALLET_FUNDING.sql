-- Test Script for Wallet Funding
-- Run these steps one by one in your Supabase SQL Editor

-- STEP 1: Check your authentication and wallets
SELECT 
  auth.uid() as "Your User ID",
  (SELECT COUNT(*) FROM public.wallets WHERE user_id = auth.uid()) as "Number of Wallets"
;

-- STEP 2: List your wallets
SELECT 
  id as "Wallet ID",
  currency as "Currency", 
  balance as "Balance",
  wallet_number as "Wallet Number",
  created_at as "Created"
FROM public.wallets 
WHERE user_id = auth.uid()
ORDER BY created_at DESC;

-- STEP 3: Test the function with your KES wallet
-- Replace 'YOUR_WALLET_ID_HERE' with the actual wallet ID from Step 2
-- Make sure to use a KES wallet!

/*
SELECT public.intasend_mpesa_fund_wallet(
  'YOUR_WALLET_ID_HERE'::UUID,  -- Replace with your KES wallet ID
  '254712345678',                -- Test phone number
  100                           -- Test amount (KSh 100)
);
*/

-- STEP 4: If you don't have a KES wallet, create one
-- Uncomment and run this if needed:

/*
INSERT INTO public.wallets (user_id, currency, balance, wallet_number)
VALUES (
  auth.uid(),
  'KES',
  0,
  'WLT-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 6))
)
RETURNING id, currency, wallet_number;
*/

-- STEP 5: Check if IntaSend functions exist
SELECT 
  routine_name as "Function Name",
  routine_type as "Type"
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%intasend%'
ORDER BY routine_name;

-- STEP 6: Check if intasend_transactions table exists
SELECT 
  column_name as "Column",
  data_type as "Type",
  is_nullable as "Nullable"
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'intasend_transactions'
ORDER BY ordinal_position;