-- Alternative Solution: Use Existing User or Create New One
-- Run these queries to find a working solution

-- OPTION 1: Find an existing user that has wallets
SELECT 
  u.id as user_id,
  u.email,
  u.full_name,
  COUNT(w.id) as wallet_count,
  STRING_AGG(w.currency, ', ') as currencies
FROM public.users u
LEFT JOIN public.wallets w ON u.id = w.user_id
GROUP BY u.id, u.email, u.full_name
HAVING COUNT(w.id) > 0
ORDER BY wallet_count DESC
LIMIT 5;

-- OPTION 2: Find users in auth.users that might need public.users records
SELECT 
  a.id,
  a.email,
  a.created_at,
  CASE 
    WHEN p.id IS NOT NULL THEN 'EXISTS IN PUBLIC.USERS'
    ELSE 'MISSING FROM PUBLIC.USERS'
  END as status
FROM auth.users a
LEFT JOIN public.users p ON a.id = p.id
ORDER BY a.created_at DESC
LIMIT 10;

-- OPTION 3: Create user record from auth.users if it exists there
-- (Only run if the user exists in auth.users but not in public.users)
INSERT INTO public.users (id, email, full_name, created_at, updated_at)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', email) as full_name,
  created_at,
  updated_at
FROM auth.users 
WHERE id = '26765a91-e5ac-4289-bf7c-1cd44336dd2d'
AND NOT EXISTS (
  SELECT 1 FROM public.users WHERE id = '26765a91-e5ac-4289-bf7c-1cd44336dd2d'
)
RETURNING id, email, full_name;

-- OPTION 4: If user doesn't exist anywhere, create a new user with a different ID
-- Get a new UUID and create both auth and public user records
SELECT gen_random_uuid() as new_user_id;

-- Then use the generated UUID to create a user:
-- INSERT INTO public.users (id, email, full_name, created_at, updated_at)
-- VALUES (
--   'NEW_UUID_FROM_ABOVE'::UUID,
--   'testuser@swiftremit.com',
--   'Test User',
--   now(),
--   now()
-- );

-- OPTION 5: Check what's in your current session (if you're logged in)
SELECT 
  auth.uid() as current_session_user,
  CASE 
    WHEN auth.uid() IS NOT NULL THEN 'AUTHENTICATED'
    ELSE 'NOT AUTHENTICATED'
  END as session_status;