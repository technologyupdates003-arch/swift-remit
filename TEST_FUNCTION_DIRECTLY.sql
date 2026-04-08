-- Test the function directly in SQL to see if it works
SELECT public.intasend_mpesa_fund_wallet(
  'f7b6e028-0487-4640-bc3e-5a7ca271fac6'::UUID,
  '254717562660',
  100
);