-- Create Wallet After User Exists
-- Run this ONLY after confirming user exists in public.users

-- QUERY 1: Confirm user exists
SELECT id, email, full_name 
FROM public.users 
WHERE id = '26765a91-e5ac-4289-bf7c-1cd44336dd2d';

-- QUERY 2: Check if they already have wallets
SELECT id, currency, balance, wallet_number, type, status
FROM public.wallets 
WHERE user_id = '26765a91-e5ac-4289-bf7c-1cd44336dd2d';

-- QUERY 3: Create KES wallet (only if user exists from Query 1)
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

-- QUERY 4: Verify wallet was created
SELECT 
  w.id as wallet_id,
  w.currency,
  w.balance,
  w.wallet_number,
  w.type,
  w.status,
  u.email as user_email,
  u.full_name as user_name
FROM public.wallets w
JOIN public.users u ON w.user_id = u.id
WHERE w.user_id = '26765a91-e5ac-4289-bf7c-1cd44336dd2d'
ORDER BY w.created_at DESC;