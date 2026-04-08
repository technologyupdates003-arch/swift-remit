INSERT INTO public.users (
  id,
  auth_user_id, 
  email,
  full_name,
  is_admin,
  kyc_status,
  failed_pin_attempts
)
VALUES (
  '26765a91-e5ac-4289-bf7c-1cd44336dd2d'::UUID,
  '26765a91-e5ac-4289-bf7c-1cd44336dd2d'::UUID,
  'cyberjl284@gmail.com',
  'Laban Khisa',
  false,
  'not_submitted',
  0
)
ON CONFLICT (id) DO NOTHING
RETURNING id, email, full_name;