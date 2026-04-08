-- Complete Fix Solution - Run after debugging
-- This will handle all possible scenarios

-- STEP 1: Drop existing foreign key constraint completely
ALTER TABLE public.wallets 
DROP CONSTRAINT IF EXISTS wallets_user_id_fkey;

-- STEP 2: Check if the user actually exists and get the correct ID
DO $$
DECLARE
  user_exists BOOLEAN := FALSE;
  correct_user_id UUID;
  user_email TEXT;
BEGIN
  -- Check if user exists in public.users
  SELECT EXISTS(
    SELECT 1 FROM public.users 
    WHERE id = '26765a91-e5ac-4289-bf7c-1cd44336dd2d'
  ) INTO user_exists;
  
  IF user_exists THEN
    RAISE NOTICE 'User found in public.users with ID: 26765a91-e5ac-4289-bf7c-1cd44336dd2d';
  ELSE
    RAISE NOTICE 'User NOT found in public.users with that ID';
    
    -- Try to find user by email from the screenshot
    SELECT id, email INTO correct_user_id, user_email
    FROM public.users 
    WHERE email IN ('cyberjl284@gmail.com', 'technologyupdates003@gmail.com', 'abancooltechnology@gmail.com')
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF correct_user_id IS NOT NULL THEN
      RAISE NOTICE 'Found user with email % and ID: %', user_email, correct_user_id;
    ELSE
      RAISE NOTICE 'No users found with expected emails';
    END IF;
  END IF;
END $$;

-- STEP 3: Create the foreign key constraint pointing to public.users
ALTER TABLE public.wallets 
ADD CONSTRAINT wallets_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- STEP 4: Create wallet using the ACTUAL user ID from your database
-- Replace this with the correct user ID from the debug results
INSERT INTO public.wallets (user_id, currency, balance, wallet_number, type, status)
SELECT 
  id as user_id,
  'KES' as currency,
  0 as balance,
  'WLT-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 6)) as wallet_number,
  'fiat' as type,
  'active' as status
FROM public.users 
WHERE email = 'cyberjl284@gmail.com'  -- Change this to your actual email
LIMIT 1
RETURNING id, user_id, currency, wallet_number, created_at;

-- STEP 5: Alternative - Create wallet for ALL users who don't have KES wallets
INSERT INTO public.wallets (user_id, currency, balance, wallet_number, type, status)
SELECT 
  u.id,
  'KES',
  0,
  'WLT-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 6)),
  'fiat',
  'active'
FROM public.users u
LEFT JOIN public.wallets w ON u.id = w.user_id AND w.currency = 'KES'
WHERE w.id IS NULL  -- Only users without KES wallets
RETURNING id, user_id, currency, wallet_number, created_at;