
DROP POLICY IF EXISTS "Users can view own KYC docs" ON public.kyc_documents;
DROP POLICY IF EXISTS "Users can upload KYC docs" ON public.kyc_documents;

CREATE POLICY "Users can view own KYC docs"
  ON public.kyc_documents FOR SELECT
  TO authenticated
  USING (user_id = get_user_id_from_auth());

CREATE POLICY "Users can upload KYC docs"
  ON public.kyc_documents FOR INSERT
  TO authenticated
  WITH CHECK (user_id = get_user_id_from_auth());

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = get_user_id_from_auth());

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = get_user_id_from_auth());
