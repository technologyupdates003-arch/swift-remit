-- Create KES Wallet for User: 26765a91-e5ac-4289-bf7c-1cd44336dd2d
-- Run these queries one by one in your Supabase SQL Editor

-- STEP 1: Check if this user exists in auth.users
SELECT 
  id,
  email,
  created_at,
  last_sign_in_at
FROM auth.users 
WHERE id = '26765a91-e5ac-4289-bf7c-1cd44336dd2d';

-- STEP 2: Check existing wallets for this user
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

-- STEP 3: Create a KES wallet for this user (if they don't have one)
INSERT INTO public.wallets (user_id, currency, balance, wallet_number, type, status)
VALUES (
  '26765a91-e5ac-4289-bf7c-1cd44336dd2d'::UUID,
  'KES', 
  0,
  'WLT-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 6)),
  'fiat',
  'active'
)
RETURNING id, currency, wallet_number, user_id, created_at;

-- STEP 4: Verify the wallet was created
SELECT 
  id,
  user_id,
  currency,
  balance,
  wallet_number,
  type,
  status
FROM public.wallets 
WHERE user_id = '26765a91-e5ac-4289-bf7c-1cd44336dd2d'
AND currency = 'KES'
ORDER BY created_at DESC;

-- STEP 5: Test the IntaSend function with the new wallet
-- Replace 'WALLET_ID_FROM_STEP_4' with the actual wallet ID returned in Step 4
/*
SELECT public.intasend_mpesa_fund_wallet(
  'WALLET_ID_FROM_STEP_4'::UUID,  -- Replace with actual wallet ID
  '254712345678',                  -- Test phone number
  100                             -- Test amount (KSh 100)
);
*/