-- Fix Authentication Issue
-- Run these queries one by one in your Supabase SQL Editor

-- STEP 1: Check current authentication status
SELECT 
  auth.uid() as current_user_id,
  CASE 
    WHEN auth.uid() IS NULL THEN 'NOT AUTHENTICATED'
    ELSE 'AUTHENTICATED'
  END as auth_status;

-- STEP 2: Check if you have any users in the auth.users table
SELECT 
  id,
  email,
  created_at,
  last_sign_in_at
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 5;

-- STEP 3: Check your wallets table structure
SELECT 
  id,
  user_id,
  currency,
  balance,
  wallet_number,
  created_at
FROM public.wallets 
ORDER BY created_at DESC 
LIMIT 5;

-- STEP 4: If you need to create a wallet for a specific user, use their actual user_id
-- First, get the user_id from auth.users, then create wallet manually:

-- Example (replace 'ACTUAL_USER_ID_HERE' with real user ID from Step 2):
/*
INSERT INTO public.wallets (user_id, currency, balance, wallet_number)
VALUES (
  'ACTUAL_USER_ID_HERE'::UUID,  -- Replace with real user ID
  'KES', 
  0,
  'WLT-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 6))
)
RETURNING id, currency, wallet_number, user_id;
*/

-- STEP 5: Test the IntaSend function with the correct user context
-- This needs to be run from your frontend application, not SQL Editor
-- Because SQL Editor doesn't have the user session context