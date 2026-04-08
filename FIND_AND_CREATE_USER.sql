-- Find and Create User: 26765a91-e5ac-4289-bf7c-1cd44336dd2d
-- Run these queries one by one in your Supabase SQL Editor

-- QUERY 1: Check if user exists in auth.users
SELECT 'auth.users' as source, id, email, created_at, last_sign_in_at
FROM auth.users 
WHERE id = '26765a91-e5ac-4289-bf7c-1cd44336dd2d';

-- QUERY 2: Check if user exists in public.users
SELECT 'public.users' as source, id, email, full_name, created_at
FROM public.users 
WHERE id = '26765a91-e5ac-4289-bf7c-1cd44336dd2d';

-- QUERY 3: List all users in public.users (to see what exists)
SELECT id, email, full_name, created_at 
FROM public.users 
ORDER BY created_at DESC 
LIMIT 10;

-- QUERY 4: List all users in auth.users (to see what exists)
SELECT id, email, created_at, last_sign_in_at
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 10;

-- QUERY 5: Check existing wallets (to see what user_ids are being used)
SELECT DISTINCT user_id, COUNT(*) as wallet_count
FROM public.wallets 
GROUP BY user_id
ORDER BY wallet_count DESC
LIMIT 10;

-- QUERY 6: If user doesn't exist in public.users, create them
-- (Only run this if Query 2 returns no results)
INSERT INTO public.users (id, email, full_name, phone, created_at, updated_at)
VALUES (
  '26765a91-e5ac-4289-bf7c-1cd44336dd2d'::UUID,
  'user@swiftremit.com',  -- Replace with actual email if known
  'Swift Remit User',     -- Replace with actual name if known
  NULL,                   -- Replace with phone if known
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING
RETURNING id, email, full_name;

-- QUERY 7: Verify user now exists in public.users
SELECT id, email, full_name, created_at
FROM public.users 
WHERE id = '26765a91-e5ac-4289-bf7c-1cd44336dd2d';