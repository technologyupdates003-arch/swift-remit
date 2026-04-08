-- Simple Step-by-Step Fix for User: 26765a91-e5ac-4289-bf7c-1cd44336dd2d
-- Run each query separately in your Supabase SQL Editor

-- QUERY 1: Check if user exists in public.users
SELECT id, email, full_name, created_at 
FROM public.users 
WHERE id = '26765a91-e5ac-4289-bf7c-1cd44336dd2d';

-- QUERY 2: Check current wallets for this user
SELECT id, user_id, currency, balance, wallet_number, type, status 
FROM public.wallets 
WHERE user_id = '26765a91-e5ac-4289-bf7c-1cd44336dd2d';

-- QUERY 3: Drop existing foreign key constraint
ALTER TABLE public.wallets DROP CONSTRAINT IF EXISTS wallets_user_id_fkey;

-- QUERY 4: Add correct foreign key constraint
ALTER TABLE public.wallets 
ADD CONSTRAINT wallets_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- QUERY 5: Create KES wallet for your user
INSERT INTO public.wallets (user_id, currency, balance, wallet_number, type, status)
VALUES (
  '26765a91-e5ac-4289-bf7c-1cd44336dd2d'::UUID,
  'KES', 
  0,
  'WLT-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 6)),
  'fiat',
  'active'
)
RETURNING id, currency, wallet_number, user_id;