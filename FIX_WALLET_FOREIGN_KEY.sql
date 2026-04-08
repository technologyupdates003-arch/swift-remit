-- Fix Wallet Foreign Key Constraint Issue
-- Run these queries one by one in your Supabase SQL Editor

-- STEP 1: Check which users table has your user
SELECT 'auth.users' as table_name, id, email, created_at 
FROM auth.users 
WHERE id = '26765a91-e5ac-4289-bf7c-1cd44336dd2d'
UNION ALL
SELECT 'public.users' as table_name, id, email, created_at 
FROM public.users 
WHERE id = '26765a91-e5ac-4289-bf7c-1cd44336dd2d';

-- STEP 2: Check current foreign key constraint on wallets table
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name = 'wallets'
AND kcu.column_name = 'user_id';

-- STEP 3: Check wallets table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'wallets'
ORDER BY ordinal_position;

-- STEP 4: Drop the existing foreign key constraint (if it exists)
ALTER TABLE public.wallets 
DROP CONSTRAINT IF EXISTS wallets_user_id_fkey;

-- STEP 5: Add correct foreign key constraint to public.users
ALTER TABLE public.wallets 
ADD CONSTRAINT wallets_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- STEP 6: Now create the KES wallet for your user
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

-- STEP 7: Verify the wallet was created
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