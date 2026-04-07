
-- Drop old RLS policies on wallets that compare auth.uid() directly to user_id
DROP POLICY IF EXISTS "Users can create own wallets" ON public.wallets;
DROP POLICY IF EXISTS "Users can update own wallets" ON public.wallets;
DROP POLICY IF EXISTS "Users can view own wallets" ON public.wallets;

-- Recreate using get_user_id_from_auth() to map auth.uid() to users.id
CREATE POLICY "Users can create own wallets" ON public.wallets
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.get_user_id_from_auth());

CREATE POLICY "Users can view own wallets" ON public.wallets
  FOR SELECT TO authenticated
  USING (user_id = public.get_user_id_from_auth());

CREATE POLICY "Users can update own wallets" ON public.wallets
  FOR UPDATE TO authenticated
  USING (user_id = public.get_user_id_from_auth());
