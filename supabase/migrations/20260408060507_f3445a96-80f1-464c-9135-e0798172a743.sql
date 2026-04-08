
CREATE TABLE public.bank_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  account_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  bank_code TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  is_verified BOOLEAN NOT NULL DEFAULT false,
  is_default BOOLEAN NOT NULL DEFAULT false,
  paystack_recipient_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bank accounts"
  ON public.bank_accounts FOR SELECT
  TO authenticated
  USING (user_id = get_user_id_from_auth());

CREATE POLICY "Users can create own bank accounts"
  ON public.bank_accounts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = get_user_id_from_auth());

CREATE POLICY "Users can update own bank accounts"
  ON public.bank_accounts FOR UPDATE
  TO authenticated
  USING (user_id = get_user_id_from_auth());

CREATE POLICY "Users can delete own bank accounts"
  ON public.bank_accounts FOR DELETE
  TO authenticated
  USING (user_id = get_user_id_from_auth());
