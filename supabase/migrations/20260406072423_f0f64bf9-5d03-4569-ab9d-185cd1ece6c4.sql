-- OTP codes are managed by edge functions using service role key, 
-- so no user-facing policies needed. Add a deny-all policy to satisfy linter.
CREATE POLICY "No direct user access to OTP codes" ON public.otp_codes FOR SELECT USING (false);
