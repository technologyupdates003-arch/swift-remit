
-- Payment logs table for tracking external microservice payments
CREATE TABLE IF NOT EXISTS public.payment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  wallet_id UUID NOT NULL,
  payment_type TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'KES',
  provider_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  provider_response JSONB,
  webhook_data JSONB,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payment logs"
  ON public.payment_logs FOR SELECT
  TO authenticated
  USING (user_id = get_user_id_from_auth());

CREATE POLICY "Users can insert own payment logs"
  ON public.payment_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = get_user_id_from_auth());

CREATE INDEX idx_payment_logs_user ON public.payment_logs(user_id);
CREATE INDEX idx_payment_logs_reference ON public.payment_logs(provider_reference);
CREATE INDEX idx_payment_logs_status ON public.payment_logs(status);

-- Trigger for updated_at
CREATE TRIGGER update_payment_logs_updated_at
  BEFORE UPDATE ON public.payment_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Database function to handle payment webhook completion
CREATE OR REPLACE FUNCTION public.handle_payment_webhook(
  p_api_ref TEXT,
  p_state TEXT,
  p_webhook_data JSONB DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payment RECORD;
  v_new_balance NUMERIC;
  v_transaction_id UUID;
BEGIN
  -- Find the pending payment log
  SELECT * INTO v_payment
  FROM public.payment_logs
  WHERE provider_reference = p_api_ref
  AND status = 'pending'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Payment not found for reference: ' || p_api_ref);
  END IF;

  -- Check if payment succeeded
  IF LOWER(p_state) IN ('completed', 'success', 'complete') THEN
    -- Update wallet balance
    UPDATE public.wallets
    SET balance = balance + v_payment.amount,
        updated_at = now()
    WHERE id = v_payment.wallet_id
    RETURNING balance INTO v_new_balance;

    -- Create transaction record
    INSERT INTO public.transactions (
      user_id, wallet_id, type, amount, currency, status, reference
    ) VALUES (
      v_payment.user_id, v_payment.wallet_id, 'deposit',
      v_payment.amount, v_payment.currency, 'completed',
      'MPESA-EXT-' || p_api_ref
    ) RETURNING id INTO v_transaction_id;

    -- Update payment log
    UPDATE public.payment_logs
    SET status = 'completed',
        completed_at = now(),
        webhook_data = COALESCE(p_webhook_data, webhook_data),
        updated_at = now()
    WHERE id = v_payment.id;

    RETURN json_build_object(
      'success', true,
      'message', 'Payment processed',
      'amount_added', v_payment.amount,
      'new_balance', v_new_balance,
      'transaction_id', v_transaction_id,
      'wallet_id', v_payment.wallet_id
    );

  ELSIF LOWER(p_state) IN ('failed', 'cancelled') THEN
    UPDATE public.payment_logs
    SET status = 'failed',
        webhook_data = COALESCE(p_webhook_data, webhook_data),
        updated_at = now()
    WHERE id = v_payment.id;

    RETURN json_build_object('success', false, 'error', 'Payment failed or cancelled');
  ELSE
    -- Pending/processing state
    UPDATE public.payment_logs
    SET webhook_data = COALESCE(p_webhook_data, webhook_data),
        updated_at = now()
    WHERE id = v_payment.id;

    RETURN json_build_object('success', false, 'message', 'Payment still processing');
  END IF;

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;
