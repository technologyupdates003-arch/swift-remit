-- Admin Fee Management Functions

-- 1. Function to update fee configuration (Admin only)
CREATE OR REPLACE FUNCTION public.update_fee_config(
  p_service_type VARCHAR(50),
  p_fee_name VARCHAR(100),
  p_fee_type VARCHAR(20),
  p_fee_amount DECIMAL(15,4),
  p_currency VARCHAR(3) DEFAULT 'KES',
  p_min_amount DECIMAL(15,2) DEFAULT NULL,
  p_max_amount DECIMAL(15,2) DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT true
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_auth_user_id UUID;
  v_user_id UUID;
  v_is_admin BOOLEAN;
BEGIN
  -- Check authentication and admin status
  v_auth_user_id := auth.uid();
  
  IF v_auth_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not authenticated');
  END IF;

  SELECT id, is_admin INTO v_user_id, v_is_admin
  FROM public.users 
  WHERE auth_user_id = v_auth_user_id;

  IF NOT FOUND OR NOT v_is_admin THEN
    RETURN json_build_object('success', false, 'error', 'Admin access required');
  END IF;

  -- Validate inputs
  IF p_fee_type NOT IN ('fixed', 'percentage') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid fee type. Must be fixed or percentage');
  END IF;

  IF p_fee_amount < 0 THEN
    RETURN json_build_object('success', false, 'error', 'Fee amount cannot be negative');
  END IF;

  -- Update or insert fee configuration
  INSERT INTO public.fee_config (
    service_type, fee_name, fee_type, fee_amount, currency,
    min_amount, max_amount, is_active, created_by
  ) VALUES (
    p_service_type, p_fee_name, p_fee_type, p_fee_amount, p_currency,
    p_min_amount, p_max_amount, p_is_active, v_user_id
  )
  ON CONFLICT (service_type, fee_name, currency)
  DO UPDATE SET
    fee_type = EXCLUDED.fee_type,
    fee_amount = EXCLUDED.fee_amount,
    min_amount = EXCLUDED.min_amount,
    max_amount = EXCLUDED.max_amount,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

  RETURN json_build_object(
    'success', true,
    'message', 'Fee configuration updated successfully'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Failed to update fee config: ' || SQLERRM);
END;
$$;

-- 2. Function to update commission configuration (Admin only)
CREATE OR REPLACE FUNCTION public.update_commission_config(
  p_service_type VARCHAR(50),
  p_commission_type VARCHAR(20),
  p_commission_rate DECIMAL(15,4),
  p_currency VARCHAR(3) DEFAULT 'KES',
  p_min_commission DECIMAL(15,2) DEFAULT NULL,
  p_max_commission DECIMAL(15,2) DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT true
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_auth_user_id UUID;
  v_user_id UUID;
  v_is_admin BOOLEAN;
BEGIN
  -- Check authentication and admin status
  v_auth_user_id := auth.uid();
  
  IF v_auth_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not authenticated');
  END IF;

  SELECT id, is_admin INTO v_user_id, v_is_admin
  FROM public.users 
  WHERE auth_user_id = v_auth_user_id;

  IF NOT FOUND OR NOT v_is_admin THEN
    RETURN json_build_object('success', false, 'error', 'Admin access required');
  END IF;

  -- Update or insert commission configuration
  INSERT INTO public.commission_config (
    service_type, commission_type, commission_rate, currency,
    min_commission, max_commission, is_active, created_by
  ) VALUES (
    p_service_type, p_commission_type, p_commission_rate, p_currency,
    p_min_commission, p_max_commission, p_is_active, v_user_id
  )
  ON CONFLICT (service_type, currency)
  DO UPDATE SET
    commission_type = EXCLUDED.commission_type,
    commission_rate = EXCLUDED.commission_rate,
    min_commission = EXCLUDED.min_commission,
    max_commission = EXCLUDED.max_commission,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

  RETURN json_build_object(
    'success', true,
    'message', 'Commission configuration updated successfully'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Failed to update commission config: ' || SQLERRM);
END;
$$;

-- 3. Function to get admin revenue report
CREATE OR REPLACE FUNCTION public.get_admin_revenue_report(
  p_date_from DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_date_to DATE DEFAULT CURRENT_DATE,
  p_service_type VARCHAR(50) DEFAULT NULL
)
RETURNS TABLE(
  service_type VARCHAR(50),
  total_fees DECIMAL(15,2),
  total_commission DECIMAL(15,2),
  transaction_count BIGINT,
  currency VARCHAR(3)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_auth_user_id UUID;
  v_is_admin BOOLEAN;
BEGIN
  -- Check authentication and admin status
  v_auth_user_id := auth.uid();
  
  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  SELECT u.is_admin INTO v_is_admin
  FROM public.users u
  WHERE u.auth_user_id = v_auth_user_id;

  IF NOT FOUND OR NOT v_is_admin THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  -- Return revenue report
  RETURN QUERY
  SELECT 
    ft.service_type,
    SUM(ft.fee_amount) as total_fees,
    SUM(ft.commission_amount) as total_commission,
    COUNT(*) as transaction_count,
    ft.currency
  FROM public.fee_transactions ft
  WHERE ft.created_at::DATE BETWEEN p_date_from AND p_date_to
    AND (p_service_type IS NULL OR ft.service_type = p_service_type)
  GROUP BY ft.service_type, ft.currency
  ORDER BY total_fees DESC;
END;
$$;

-- 4. Function to get fee configuration (Admin only)
CREATE OR REPLACE FUNCTION public.get_fee_configurations()
RETURNS TABLE(
  id UUID,
  service_type VARCHAR(50),
  fee_name VARCHAR(100),
  fee_type VARCHAR(20),
  fee_amount DECIMAL(15,4),
  currency VARCHAR(3),
  min_amount DECIMAL(15,2),
  max_amount DECIMAL(15,2),
  is_active BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_auth_user_id UUID;
  v_is_admin BOOLEAN;
BEGIN
  -- Check authentication and admin status
  v_auth_user_id := auth.uid();
  
  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  SELECT u.is_admin INTO v_is_admin
  FROM public.users u
  WHERE u.auth_user_id = v_auth_user_id;

  IF NOT FOUND OR NOT v_is_admin THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  -- Return fee configurations
  RETURN QUERY
  SELECT 
    fc.id, fc.service_type, fc.fee_name, fc.fee_type, 
    fc.fee_amount, fc.currency, fc.min_amount, fc.max_amount,
    fc.is_active, fc.created_at
  FROM public.fee_config fc
  ORDER BY fc.service_type, fc.fee_name;
END;
$$;

-- 5. Function to get commission configurations (Admin only)
CREATE OR REPLACE FUNCTION public.get_commission_configurations()
RETURNS TABLE(
  id UUID,
  service_type VARCHAR(50),
  commission_type VARCHAR(20),
  commission_rate DECIMAL(15,4),
  currency VARCHAR(3),
  min_commission DECIMAL(15,2),
  max_commission DECIMAL(15,2),
  is_active BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_auth_user_id UUID;
  v_is_admin BOOLEAN;
BEGIN
  -- Check authentication and admin status
  v_auth_user_id := auth.uid();
  
  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  SELECT u.is_admin INTO v_is_admin
  FROM public.users u
  WHERE u.auth_user_id = v_auth_user_id;

  IF NOT FOUND OR NOT v_is_admin THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  -- Return commission configurations
  RETURN QUERY
  SELECT 
    cc.id, cc.service_type, cc.commission_type, cc.commission_rate,
    cc.currency, cc.min_commission, cc.max_commission,
    cc.is_active, cc.created_at
  FROM public.commission_config cc
  ORDER BY cc.service_type;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.update_fee_config(VARCHAR(50), VARCHAR(100), VARCHAR(20), DECIMAL(15,4), VARCHAR(3), DECIMAL(15,2), DECIMAL(15,2), BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_commission_config(VARCHAR(50), VARCHAR(20), DECIMAL(15,4), VARCHAR(3), DECIMAL(15,2), DECIMAL(15,2), BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_revenue_report(DATE, DATE, VARCHAR(50)) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_fee_configurations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_commission_configurations() TO authenticated;