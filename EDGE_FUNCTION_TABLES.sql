-- Database tables required for Edge Functions
-- Run this to create all necessary tables

-- 1. Paystack transactions table
CREATE TABLE IF NOT EXISTS public.paystack_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  paystack_reference VARCHAR(100) UNIQUE NOT NULL,
  paystack_transaction_id VARCHAR(100),
  access_code VARCHAR(100),
  authorization_url TEXT,
  amount DECIMAL(15,2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  payment_method VARCHAR(50),
  gateway_response TEXT,
  fees DECIMAL(15,2) DEFAULT 0,
  customer_code VARCHAR(100),
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.paystack_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policy for paystack_transactions
CREATE POLICY "Users can manage their own paystack transactions" ON public.paystack_transactions
FOR ALL USING (
  user_id IN (
    SELECT id FROM public.users WHERE auth_user_id = auth.uid()
  )
);

-- 2. IntaSend transactions table (if not exists)
CREATE TABLE IF NOT EXISTS public.intasend_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  phone_number VARCHAR(15) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'KES',
  transaction_type VARCHAR(20) NOT NULL, -- 'fund', 'withdraw'
  intasend_transaction_id VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'completed', 'failed'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on intasend_transactions
ALTER TABLE public.intasend_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policy for intasend_transactions
CREATE POLICY "Users can manage their own intasend transactions" ON public.intasend_transactions
FOR ALL USING (
  user_id IN (
    SELECT id FROM public.users WHERE auth_user_id = auth.uid()
  )
);

-- 3. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_paystack_transactions_user_id ON public.paystack_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_paystack_transactions_wallet_id ON public.paystack_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_paystack_transactions_reference ON public.paystack_transactions(paystack_reference);
CREATE INDEX IF NOT EXISTS idx_paystack_transactions_status ON public.paystack_transactions(status);

CREATE INDEX IF NOT EXISTS idx_intasend_transactions_wallet_id ON public.intasend_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_intasend_transactions_user_id ON public.intasend_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_intasend_transactions_status ON public.intasend_transactions(status);
CREATE INDEX IF NOT EXISTS idx_intasend_transactions_type ON public.intasend_transactions(transaction_type);

-- 4. Updated trigger for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
DROP TRIGGER IF EXISTS update_paystack_transactions_updated_at ON public.paystack_transactions;
CREATE TRIGGER update_paystack_transactions_updated_at 
    BEFORE UPDATE ON public.paystack_transactions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_intasend_transactions_updated_at ON public.intasend_transactions;
CREATE TRIGGER update_intasend_transactions_updated_at 
    BEFORE UPDATE ON public.intasend_transactions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();