-- Complete Fee Management & SMS System
-- Admin-configurable fees for all services

-- 1. Fee Configuration Table
CREATE TABLE IF NOT EXISTS public.fee_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type VARCHAR(50) NOT NULL, -- 'transaction', 'sms', 'statement_download', 'currency_exchange'
  fee_name VARCHAR(100) NOT NULL,
  fee_type VARCHAR(20) NOT NULL, -- 'fixed', 'percentage'
  fee_amount DECIMAL(15,4) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'KES',
  min_amount DECIMAL(15,2) DEFAULT 0,
  max_amount DECIMAL(15,2),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(service_type, fee_name, currency)
);

-- 2. Commission Configuration Table
CREATE TABLE IF NOT EXISTS public.commission_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type VARCHAR(50) NOT NULL,
  commission_type VARCHAR(20) NOT NULL, -- 'fixed', 'percentage'
  commission_rate DECIMAL(15,4) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'KES',
  min_commission DECIMAL(15,2) DEFAULT 0,
  max_commission DECIMAL(15,2),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(service_type, currency)
);

-- 3. Fee Transactions Table (Track all fees charged)
CREATE TABLE IF NOT EXISTS public.fee_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  wallet_id UUID REFERENCES public.wallets(id) ON DELETE CASCADE,
  service_type VARCHAR(50) NOT NULL,
  service_description TEXT NOT NULL,
  fee_amount DECIMAL(15,2) NOT NULL,
  commission_amount DECIMAL(15,2) DEFAULT 0,
  currency VARCHAR(3) NOT NULL,
  reference_id UUID, -- Link to original transaction/service
  status VARCHAR(20) DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. SMS Log Table
CREATE TABLE IF NOT EXISTS public.sms_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  phone_number VARCHAR(15) NOT NULL,
  message TEXT NOT NULL,
  sms_type VARCHAR(50) NOT NULL, -- 'transaction', 'otp', 'notification', 'statement'
  cost DECIMAL(15,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'KES',
  talksasa_response JSONB,
  status VARCHAR(20) DEFAULT 'sent', -- 'sent', 'failed', 'pending'
  reference_id UUID, -- Link to transaction/service
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Statement Downloads Table
CREATE TABLE IF NOT EXISTS public.statement_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  wallet_id UUID REFERENCES public.wallets(id) ON DELETE CASCADE,
  statement_type VARCHAR(50) NOT NULL, -- 'monthly', 'custom', 'annual'
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  fee_charged DECIMAL(15,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'KES',
  file_path TEXT,
  download_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.fee_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statement_downloads ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Fee config - only admins can manage
CREATE POLICY "Only admins can manage fee config" ON public.fee_config
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE auth_user_id = auth.uid() AND is_admin = true
  )
);

-- Commission config - only admins can manage
CREATE POLICY "Only admins can manage commission config" ON public.commission_config
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE auth_user_id = auth.uid() AND is_admin = true
  )
);

-- Fee transactions - users can view their own
CREATE POLICY "Users can view their own fee transactions" ON public.fee_transactions
FOR SELECT USING (
  user_id IN (
    SELECT id FROM public.users WHERE auth_user_id = auth.uid()
  )
);

-- SMS log - users can view their own
CREATE POLICY "Users can view their own sms log" ON public.sms_log
FOR SELECT USING (
  user_id IN (
    SELECT id FROM public.users WHERE auth_user_id = auth.uid()
  )
);

-- Statement downloads - users can view their own
CREATE POLICY "Users can view their own statement downloads" ON public.statement_downloads
FOR SELECT USING (
  user_id IN (
    SELECT id FROM public.users WHERE auth_user_id = auth.uid()
  )
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_fee_config_service_type ON public.fee_config(service_type);
CREATE INDEX IF NOT EXISTS idx_fee_config_active ON public.fee_config(is_active);
CREATE INDEX IF NOT EXISTS idx_commission_config_service_type ON public.commission_config(service_type);
CREATE INDEX IF NOT EXISTS idx_fee_transactions_user_id ON public.fee_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_fee_transactions_service_type ON public.fee_transactions(service_type);
CREATE INDEX IF NOT EXISTS idx_sms_log_user_id ON public.sms_log(user_id);
CREATE INDEX IF NOT EXISTS idx_sms_log_type ON public.sms_log(sms_type);
CREATE INDEX IF NOT EXISTS idx_statement_downloads_user_id ON public.statement_downloads(user_id);

-- Insert default fee configurations
INSERT INTO public.fee_config (service_type, fee_name, fee_type, fee_amount, currency) VALUES
('transaction', 'Transfer Fee', 'fixed', 10.00, 'KES'),
('transaction', 'Withdrawal Fee', 'percentage', 1.5, 'KES'),
('transaction', 'Deposit Fee', 'fixed', 5.00, 'KES'),
('sms', 'SMS Notification', 'fixed', 2.00, 'KES'),
('sms', 'OTP SMS', 'fixed', 2.50, 'KES'),
('statement_download', 'Monthly Statement', 'fixed', 50.00, 'KES'),
('statement_download', 'Custom Statement', 'fixed', 75.00, 'KES'),
('currency_exchange', 'Exchange Fee', 'percentage', 2.0, 'KES')
ON CONFLICT (service_type, fee_name, currency) DO NOTHING;

-- Insert default commission configurations
INSERT INTO public.commission_config (service_type, commission_type, commission_rate, currency) VALUES
('transaction', 'percentage', 0.5, 'KES'),
('sms', 'percentage', 10.0, 'KES'),
('statement_download', 'percentage', 20.0, 'KES'),
('currency_exchange', 'percentage', 25.0, 'KES')
ON CONFLICT (service_type, currency) DO NOTHING;