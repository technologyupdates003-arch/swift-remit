SELECT 
  id,
  email,
  full_name,
  auth_user_id,
  created_at
FROM public.users 
ORDER BY created_at DESC;