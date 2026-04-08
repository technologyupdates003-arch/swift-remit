-- Final Test for User: 26765a91-e5ac-4289-bf7c-1cd44336dd2d
-- Run these after fixing the foreign key constraint

-- STEP 1: Verify user exists in public.users
SELECT 
  id,
  email,
  full_name,
  created_at
FROM public.users 
WHERE id = '26765a91-e5ac-4289-bf7c-1cd44336dd2d';

-- STEP 2: Check all wallets for this user
SELECT 
  id,
  user_id,
  currency,
  balance,
  wallet_number,
  type,
  status,
  created_at
FROM public.wallets 
WHERE user_id = '26765a91-e5ac-4289-bf7c-1cd44336dd2d'
ORDER BY created_at DESC;

-- STEP 3: Test IntaSend function with the KES wallet
-- Replace 'KES_WALLET_ID_HERE' with the actual KES wallet ID from Step 2
/*
SELECT public.intasend_mpesa_fund_wallet(
  'KES_WALLET_ID_HERE'::UUID,  -- Replace with actual KES wallet ID
  '254712345678',               -- Test phone number
  100                          -- Test amount (KSh 100)
);
*/

-- STEP 4: Check if the test transaction was created
SELECT 
  id,
  user_id,
  wallet_id,
  transaction_type,
  amount,
  currency,
  phone_number,
  status,
  created_at
FROM public.intasend_transactions 
WHERE user_id = '26765a91-e5ac-4289-bf7c-1cd44336dd2d'
ORDER BY created_at DESC
LIMIT 5;