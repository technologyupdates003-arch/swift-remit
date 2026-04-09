ALTER TABLE public.payment_logs
ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_payment_logs_provider_reference
ON public.payment_logs (provider_reference);

CREATE INDEX IF NOT EXISTS idx_payment_logs_status
ON public.payment_logs (status);

CREATE INDEX IF NOT EXISTS idx_intasend_transactions_transaction_id
ON public.intasend_transactions (intasend_transaction_id)
WHERE intasend_transaction_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.backfill_legacy_intasend_payment_logs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  INSERT INTO public.payment_logs (
    user_id,
    wallet_id,
    payment_type,
    amount,
    currency,
    provider_reference,
    status,
    provider_response,
    metadata
  )
  SELECT
    t.user_id,
    t.wallet_id,
    CASE
      WHEN t.transaction_type IN ('fund', 'mpesa_fund') THEN 'mpesa_stk'
      WHEN t.transaction_type IN ('withdraw', 'mpesa_withdraw') THEN 'daraja_b2c'
      ELSE t.transaction_type
    END,
    t.amount,
    t.currency,
    t.id::text,
    CASE
      WHEN lower(coalesce(t.status, 'pending')) IN ('completed', 'success', 'successful') THEN 'completed'
      WHEN lower(coalesce(t.status, 'pending')) IN ('failed', 'cancelled', 'canceled') THEN 'failed'
      ELSE 'pending'
    END,
    t.intasend_response,
    jsonb_strip_nulls(jsonb_build_object(
      'provider', 'intasend',
      'legacy_transaction_id', t.id,
      'legacy_transaction_type', t.transaction_type,
      'phone_number', t.phone_number,
      'recipient_name', t.recipient_name,
      'narrative', t.narrative,
      'balance_change_mode', CASE
        WHEN t.transaction_type IN ('fund', 'mpesa_fund') THEN 'credit_on_success'
        ELSE 'no_balance_change'
      END
    ))
  FROM public.intasend_transactions t
  LEFT JOIN public.payment_logs p
    ON p.provider_reference = t.id::text
  WHERE p.id IS NULL
    AND t.user_id IS NOT NULL
    AND t.wallet_id IS NOT NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_legacy_intasend_payment_logs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_legacy_intasend_payment_logs() TO service_role;

CREATE OR REPLACE FUNCTION public.handle_payment_webhook(
  p_api_ref text,
  p_state text,
  p_webhook_data jsonb DEFAULT NULL::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment_log public.payment_logs%ROWTYPE;
  v_legacy_intasend public.intasend_transactions%ROWTYPE;
  v_wallet_record public.wallets%ROWTYPE;
  v_receiver_wallet_record public.wallets%ROWTYPE;
  v_balance_mode text := '';
  v_amount_change numeric(15,2) := 0;
  v_normalized_state text := lower(coalesce(p_state, 'pending'));
  v_reference text;
  v_transaction_type public.transaction_type := 'deposit';
  v_receiver_wallet_id uuid;
  v_receiver_user_id uuid;
BEGIN
  SELECT *
  INTO v_payment_log
  FROM public.payment_logs
  WHERE provider_reference = p_api_ref
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    SELECT *
    INTO v_legacy_intasend
    FROM public.intasend_transactions
    WHERE id::text = p_api_ref
       OR intasend_transaction_id = p_api_ref
    ORDER BY created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
      RETURN json_build_object('success', false, 'error', 'Payment log not found');
    END IF;

    INSERT INTO public.payment_logs (
      user_id,
      wallet_id,
      payment_type,
      amount,
      currency,
      provider_reference,
      status,
      provider_response,
      metadata,
      webhook_data
    )
    VALUES (
      v_legacy_intasend.user_id,
      v_legacy_intasend.wallet_id,
      CASE
        WHEN v_legacy_intasend.transaction_type IN ('fund', 'mpesa_fund') THEN 'mpesa_stk'
        WHEN v_legacy_intasend.transaction_type IN ('withdraw', 'mpesa_withdraw') THEN 'daraja_b2c'
        ELSE v_legacy_intasend.transaction_type
      END,
      v_legacy_intasend.amount,
      v_legacy_intasend.currency,
      p_api_ref,
      'pending',
      v_legacy_intasend.intasend_response,
      jsonb_strip_nulls(jsonb_build_object(
        'provider', 'intasend',
        'legacy_transaction_id', v_legacy_intasend.id,
        'legacy_transaction_type', v_legacy_intasend.transaction_type,
        'phone_number', v_legacy_intasend.phone_number,
        'recipient_name', v_legacy_intasend.recipient_name,
        'narrative', v_legacy_intasend.narrative,
        'balance_change_mode', CASE
          WHEN v_legacy_intasend.transaction_type IN ('fund', 'mpesa_fund') THEN 'credit_on_success'
          ELSE 'no_balance_change'
        END
      )),
      p_webhook_data
    )
    RETURNING * INTO v_payment_log;
  END IF;

  IF v_normalized_state IN ('completed', 'success', 'successful', 'complete') THEN
    IF v_payment_log.status = 'completed' THEN
      SELECT * INTO v_wallet_record
      FROM public.wallets
      WHERE id = v_payment_log.wallet_id;

      RETURN json_build_object(
        'success', true,
        'message', 'Payment already processed',
        'payment_id', v_payment_log.id,
        'wallet_id', v_payment_log.wallet_id,
        'amount_added', 0,
        'new_balance', coalesce(v_wallet_record.balance, 0),
        'payment_type', v_payment_log.payment_type,
        'already_processed', true
      );
    END IF;

    v_balance_mode := coalesce(
      nullif(v_payment_log.metadata ->> 'balance_change_mode', ''),
      CASE
        WHEN v_payment_log.payment_type IN ('mpesa_stk', 'paystack_card') THEN 'credit_on_success'
        WHEN v_payment_log.payment_type IN ('paystack_bank', 'daraja_b2c', 'wallet_transfer', 'mpesa_withdraw') THEN 'no_balance_change'
        ELSE 'credit_on_success'
      END
    );

    IF v_balance_mode = 'credit_on_success' THEN
      UPDATE public.wallets
      SET balance = balance + v_payment_log.amount,
          updated_at = now()
      WHERE id = v_payment_log.wallet_id
      RETURNING * INTO v_wallet_record;

      IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Wallet not found');
      END IF;

      v_amount_change := v_payment_log.amount;

    ELSIF v_balance_mode = 'debit_on_success' THEN
      UPDATE public.wallets
      SET balance = balance - v_payment_log.amount,
          updated_at = now()
      WHERE id = v_payment_log.wallet_id
        AND balance >= v_payment_log.amount
      RETURNING * INTO v_wallet_record;

      IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Insufficient wallet balance or wallet not found');
      END IF;

      v_amount_change := -v_payment_log.amount;

    ELSIF v_balance_mode = 'move_on_success' THEN
      v_receiver_wallet_id := nullif(v_payment_log.metadata ->> 'receiver_wallet_id', '')::uuid;

      IF v_receiver_wallet_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Receiver wallet not provided');
      END IF;

      UPDATE public.wallets
      SET balance = balance - v_payment_log.amount,
          updated_at = now()
      WHERE id = v_payment_log.wallet_id
        AND balance >= v_payment_log.amount
      RETURNING * INTO v_wallet_record;

      IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Insufficient sender wallet balance or wallet not found');
      END IF;

      UPDATE public.wallets
      SET balance = balance + v_payment_log.amount,
          updated_at = now()
      WHERE id = v_receiver_wallet_id
      RETURNING * INTO v_receiver_wallet_record;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Receiver wallet not found';
      END IF;

      v_amount_change := -v_payment_log.amount;
      v_receiver_user_id := v_receiver_wallet_record.user_id;

    ELSE
      SELECT * INTO v_wallet_record
      FROM public.wallets
      WHERE id = v_payment_log.wallet_id;

      IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Wallet not found');
      END IF;
    END IF;

    v_reference := coalesce(nullif(v_payment_log.metadata ->> 'transaction_reference', ''), 'PAYMENT-' || p_api_ref);

    v_transaction_type := CASE
      WHEN v_payment_log.payment_type IN ('mpesa_stk', 'paystack_card') THEN 'deposit'::public.transaction_type
      WHEN v_payment_log.payment_type IN ('paystack_bank', 'daraja_b2c', 'mpesa_withdraw') THEN 'withdrawal'::public.transaction_type
      WHEN v_payment_log.payment_type = 'wallet_transfer' THEN 'transfer'::public.transaction_type
      ELSE 'deposit'::public.transaction_type
    END;

    IF NOT EXISTS (
      SELECT 1
      FROM public.transactions
      WHERE reference = v_reference
    ) THEN
      INSERT INTO public.transactions (
        user_id,
        wallet_id,
        sender_wallet_id,
        receiver_wallet_id,
        sender_user_id,
        receiver_user_id,
        type,
        amount,
        currency,
        status,
        reference,
        network,
        fee
      )
      VALUES (
        v_payment_log.user_id,
        CASE WHEN v_transaction_type = 'transfer'::public.transaction_type THEN NULL ELSE v_payment_log.wallet_id END,
        CASE WHEN v_transaction_type = 'transfer'::public.transaction_type THEN v_payment_log.wallet_id ELSE NULL END,
        CASE WHEN v_transaction_type = 'transfer'::public.transaction_type THEN v_receiver_wallet_id ELSE NULL END,
        CASE WHEN v_transaction_type = 'transfer'::public.transaction_type THEN v_payment_log.user_id ELSE NULL END,
        CASE WHEN v_transaction_type = 'transfer'::public.transaction_type THEN v_receiver_user_id ELSE NULL END,
        v_transaction_type,
        v_payment_log.amount,
        v_payment_log.currency,
        'completed',
        v_reference,
        coalesce(v_payment_log.metadata ->> 'network', v_payment_log.metadata ->> 'provider', v_payment_log.payment_type),
        coalesce(nullif(v_payment_log.metadata ->> 'fee', '')::numeric, 0)
      );
    END IF;

    UPDATE public.payment_logs
    SET status = 'completed',
        webhook_data = coalesce(p_webhook_data, webhook_data),
        completed_at = coalesce(completed_at, now()),
        updated_at = now(),
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'last_processed_state', v_normalized_state,
          'last_processed_at', now(),
          'provider_reference', p_api_ref
        )
    WHERE id = v_payment_log.id
    RETURNING * INTO v_payment_log;

    UPDATE public.intasend_transactions
    SET status = 'completed',
        intasend_transaction_id = coalesce(
          intasend_transaction_id,
          p_webhook_data -> 'invoice' ->> 'invoice_id',
          p_api_ref
        ),
        intasend_response = coalesce(p_webhook_data, intasend_response),
        updated_at = now()
    WHERE id::text = p_api_ref
       OR id = nullif(v_payment_log.metadata ->> 'legacy_transaction_id', '')::uuid
       OR intasend_transaction_id = p_api_ref;

    RETURN json_build_object(
      'success', true,
      'message', 'Payment processed successfully',
      'payment_id', v_payment_log.id,
      'wallet_id', v_payment_log.wallet_id,
      'amount_added', v_amount_change,
      'new_balance', v_wallet_record.balance,
      'payment_type', v_payment_log.payment_type,
      'already_processed', false
    );

  ELSIF v_normalized_state IN ('failed', 'cancelled', 'canceled', 'timeout', 'expired') THEN
    IF v_payment_log.status = 'completed' THEN
      RETURN json_build_object('success', false, 'error', 'Payment already completed and cannot be marked failed');
    END IF;

    UPDATE public.payment_logs
    SET status = 'failed',
        webhook_data = coalesce(p_webhook_data, webhook_data),
        updated_at = now(),
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'last_processed_state', v_normalized_state,
          'last_processed_at', now()
        )
    WHERE id = v_payment_log.id
    RETURNING * INTO v_payment_log;

    UPDATE public.intasend_transactions
    SET status = 'failed',
        intasend_response = coalesce(p_webhook_data, intasend_response),
        updated_at = now()
    WHERE id::text = p_api_ref
       OR id = nullif(v_payment_log.metadata ->> 'legacy_transaction_id', '')::uuid
       OR intasend_transaction_id = p_api_ref;

    RETURN json_build_object(
      'success', false,
      'message', 'Payment failed',
      'payment_id', v_payment_log.id,
      'payment_type', v_payment_log.payment_type
    );
  END IF;

  UPDATE public.payment_logs
  SET webhook_data = coalesce(p_webhook_data, webhook_data),
      updated_at = now(),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'last_processed_state', v_normalized_state,
        'last_processed_at', now()
      )
  WHERE id = v_payment_log.id
  RETURNING * INTO v_payment_log;

  RETURN json_build_object(
    'success', false,
    'message', 'Payment still processing',
    'payment_id', v_payment_log.id,
    'payment_type', v_payment_log.payment_type
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

REVOKE ALL ON FUNCTION public.handle_payment_webhook(text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_payment_webhook(text, text, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.handle_wallet_transfer(
  p_sender_wallet_id uuid,
  p_receiver_wallet_id uuid,
  p_amount numeric,
  p_reference text DEFAULT NULL::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_user_id uuid;
  v_sender_wallet public.wallets%ROWTYPE;
  v_receiver_wallet public.wallets%ROWTYPE;
  v_reference text := coalesce(nullif(p_reference, ''), 'WALLET-' || gen_random_uuid()::text);
  v_transaction_id uuid;
BEGIN
  v_actor_user_id := public.get_user_id_from_auth();

  IF v_actor_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not authenticated');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  SELECT * INTO v_sender_wallet
  FROM public.wallets
  WHERE id = p_sender_wallet_id
    AND user_id = v_actor_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Sender wallet not found or access denied');
  END IF;

  SELECT * INTO v_receiver_wallet
  FROM public.wallets
  WHERE id = p_receiver_wallet_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Receiver wallet not found');
  END IF;

  IF v_sender_wallet.id = v_receiver_wallet.id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot transfer to the same wallet');
  END IF;

  IF v_sender_wallet.currency <> v_receiver_wallet.currency THEN
    RETURN json_build_object('success', false, 'error', 'Currency mismatch between wallets');
  END IF;

  IF v_sender_wallet.balance < p_amount THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  UPDATE public.wallets
  SET balance = balance - p_amount,
      updated_at = now()
  WHERE id = p_sender_wallet_id;

  UPDATE public.wallets
  SET balance = balance + p_amount,
      updated_at = now()
  WHERE id = p_receiver_wallet_id
  RETURNING * INTO v_receiver_wallet;

  INSERT INTO public.transactions (
    user_id,
    wallet_id,
    sender_wallet_id,
    receiver_wallet_id,
    sender_user_id,
    receiver_user_id,
    type,
    amount,
    currency,
    status,
    reference
  )
  VALUES (
    v_actor_user_id,
    p_sender_wallet_id,
    p_sender_wallet_id,
    p_receiver_wallet_id,
    v_actor_user_id,
    v_receiver_wallet.user_id,
    'transfer',
    p_amount,
    v_sender_wallet.currency,
    'completed',
    v_reference
  )
  RETURNING id INTO v_transaction_id;

  INSERT INTO public.notifications (user_id, message, type)
  VALUES
    (
      v_actor_user_id,
      'You sent ' || v_sender_wallet.currency || ' ' || p_amount::text || ' to wallet ' || v_receiver_wallet.wallet_number,
      'transfer'
    ),
    (
      v_receiver_wallet.user_id,
      'You received ' || v_receiver_wallet.currency || ' ' || p_amount::text || ' from wallet ' || v_sender_wallet.wallet_number,
      'transfer'
    );

  RETURN json_build_object(
    'success', true,
    'message', 'Transfer completed',
    'sender_wallet_id', p_sender_wallet_id,
    'receiver_wallet_id', p_receiver_wallet_id,
    'amount_transferred', p_amount,
    'reference', v_reference,
    'transaction_id', v_transaction_id,
    'receiver_new_balance', v_receiver_wallet.balance
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

REVOKE ALL ON FUNCTION public.handle_wallet_transfer(uuid, uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.handle_wallet_transfer(uuid, uuid, numeric, text) TO authenticated, service_role;