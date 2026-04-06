
-- Add auth_user_id to link with Supabase Auth
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;
ALTER TABLE public.users ALTER COLUMN phone DROP NOT NULL;

-- Update RLS to also match on auth_user_id
CREATE POLICY "Users can view own profile by auth id" ON public.users FOR SELECT USING (auth.uid() = auth_user_id);
CREATE POLICY "Users can update own profile by auth id" ON public.users FOR UPDATE USING (auth.uid() = auth_user_id);
CREATE POLICY "Users can insert own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = auth_user_id);

-- Also update wallet/transaction policies to work with auth_user_id
-- Users can view wallets where their auth id matches the user's auth_user_id
CREATE OR REPLACE FUNCTION public.get_user_id_from_auth()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1
$$;
