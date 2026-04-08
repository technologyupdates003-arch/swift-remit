-- Create a very simple test function to see if RPC works at all
CREATE OR REPLACE FUNCTION public.test_rpc_connection()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN json_build_object(
    'success', true,
    'message', 'RPC connection is working',
    'timestamp', NOW()
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.test_rpc_connection() TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_rpc_connection() TO anon;