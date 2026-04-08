SELECT 
  'Found in public.users' as status,
  id, 
  email, 
  full_name,
  created_at
FROM public.users 
WHERE id = '26765a91-e5ac-4289-bf7c-1cd44336dd2d';