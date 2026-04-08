INSERT INTO public.wallets (user_id, currency, balance, wallet_number, type, status)
VALUES (
  '607cb796-1d5b-47ac-b939-01f47d7d1544'::UUID,
  'KES', 
  0,
  'WLT-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 6)),
  'fiat',
  'active'
)
RETURNING id, currency, wallet_number, user_id, created_at;