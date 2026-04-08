-- Debug User Issue - Find out what's really happening
-- Run these queries one by one to investigate

-- Query 1: Check if user exists in public.users (exact match)
SELECT 
  'Found in public.users' as status,
  id, 
  email, 
  full_name,
  created_at
FROM public.users 
WHERE id = '26765a91-e5ac-4289-bf7c-1cd44336dd2d';

-- Query 2: Check if user exists in auth.users
SELECT 
  'Found in auth.users' as status,
  id, 
  email, 
  created_at
FROM auth.users 
WHERE id = '26765a91-e5ac-4289-bf7c-1cd44336dd2d';

-- Query 3: List all users in public.users to see actual IDs
SELECT 
  id,
  email,
  full_name,
  auth_user_id,
  created_at
FROM public.users 
ORDER BY created_at DESC
LIMIT 10;

-- Query 4: Check current foreign key constraint details
SELECT 
  tc.constraint_name,
  tc.table_name, 
  kcu.column_name, 
  ccu.table_schema AS foreign_table_schema,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name = 'wallets'
AND kcu.column_name = 'user_id';

-- Query 5: Check wallets table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'wallets'
ORDER BY ordinal_position;

-- Query 6: Check if there are any existing wallets
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