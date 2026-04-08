-- Simple Wallet Foreign Key Fix
-- Copy and paste each query one by one in Supabase SQL Editor

-- Query 1: Check current foreign key constraint
SELECT 
    tc.constraint_name,
    tc.table_name, 
    kcu.column_name, 
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

-- Query 2: Drop the wrong foreign key constraint
ALTER TABLE public.wallets 
DROP CONSTRAINT IF EXISTS wallets_user_id_fkey;

-- Query 3: Add correct foreign key to public.users
ALTER TABLE public.wallets 
ADD CONSTRAINT wallets_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Query 4: Create KES wallet for your user
INSERT INTO public.wallets (user_id, currency, balance, wallet_number, type, status)
VALUES (
  '26765a91-e5ac-4289-bf7c-1cd44336dd2d'::UUID,
  'KES', 
  0,
  'WLT-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 6)),
  'fiat',
  'active'
)
RETURNING id, currency, wallet_number, balance, created_at;

-- Query 5: Verify wallet creation
SELECT 
  w.id,
  w.user_id,
  u.full_name,
  u.email,
  w.currency,
  w.balance,
  w.wallet_number,
  w.created_at
FROM public.wallets w
JOIN public.users u ON w.user_id = u.id
WHERE w.user_id = '26765a91-e5ac-4289-bf7c-1cd44336dd2d'
ORDER BY w.created_at DESC;