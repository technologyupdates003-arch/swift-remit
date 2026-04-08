# 🔑 Environment Variables Setup for Aban Remit

Simple guide to set up your live Paystack keys for production.

## Step 1: Get Your Live Paystack Keys

1. Go to [Paystack Dashboard](https://dashboard.paystack.com/#/settings/developer)
2. Switch to **Live Mode** (toggle in top right)
3. Copy your **Public Key** (starts with `pk_live_`)
4. Copy your **Secret Key** (starts with `sk_live_`)

## Step 2: Update Your .env File

Replace the placeholder values in your `.env` file:

```env
# Supabase Configuration (already set)
VITE_SUPABASE_PROJECT_ID="swisiaxjxvuqkcjkxcnm"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3aXNpYXhqeHZ1cWtjamt4Y25tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MTU0OTksImV4cCI6MjA5MDk5MTQ5OX0.vFKugq0S9FAGo4zVlMQ5QY_ClOu0s9YCXwNWt04kknY"
VITE_SUPABASE_URL="https://swisiaxjxvuqkcjkxcnm.supabase.co"

# Replace these with your actual live keys
VITE_PAYSTACK_PUBLIC_KEY="pk_live_your_actual_public_key_here"
PAYSTACK_SECRET_KEY="sk_live_your_actual_secret_key_here"

# App name
VITE_APP_NAME="Aban Remit"
```

## Step 3: Set Supabase Secrets

You need to set the secret key in Supabase for the Edge Functions:

### Option A: Using Supabase CLI
```bash
supabase login
supabase secrets set PAYSTACK_SECRET_KEY=sk_live_your_actual_secret_key_here
```

### Option B: Using Supabase Dashboard
1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/swisiaxjxvuqkcjkxcnm)
2. Navigate to **Settings** → **Edge Functions**
3. In **Environment Variables** section, add:
   - **Name**: `PAYSTACK_SECRET_KEY`
   - **Value**: `sk_live_your_actual_secret_key_here`
4. Click **Save**

## Step 4: Configure Paystack Webhooks

In your [Paystack Dashboard](https://dashboard.paystack.com/#/settings/developer), add these webhook URLs:

### Webhook 1: Fund Wallet
```
URL: https://swisiaxjxvuqkcjkxcnm.supabase.co/functions/v1/fund-wallet
Events: charge.success, charge.failed
```

### Webhook 2: Withdrawals
```
URL: https://swisiaxjxvuqkcjkxcnm.supabase.co/functions/v1/withdraw-to-bank
Events: transfer.success, transfer.failed, transfer.reversed
```

## Step 5: Deploy to Production

Run the deployment script:

```bash
# Set your secret key for deployment
export PAYSTACK_SECRET_KEY=sk_live_your_actual_secret_key_here

# Run deployment
chmod +x deploy-production.sh
./deploy-production.sh
```

## 🎯 Your Production URLs

After deployment, your app will be available at:

**Main App**: https://swisiaxjxvuqkcjkxcnm.supabase.co

**API Endpoints**:
- Fund Wallet: https://swisiaxjxvuqkcjkxcnm.supabase.co/functions/v1/fund-wallet
- Withdraw: https://swisiaxjxvuqkcjkxcnm.supabase.co/functions/v1/withdraw-to-bank

## ⚠️ Security Notes

1. **Never commit your `.env` file** - it's already in `.gitignore`
2. **Keep your secret key private** - never share it or put it in frontend code
3. **Test with small amounts first** - use ₦100-500 for initial testing
4. **Monitor your transactions** - check both Supabase and Paystack dashboards

## 🧪 Testing

### Test Cards (Live Mode - Small Amounts Only)
```
Card Number: 4084084084084081
CVV: Any 3 digits
Expiry: Any future date
Amount: ₦100 (for testing)
```

### Test Bank Account (For Withdrawals)
Use your real bank account with small amounts (₦100-500) for testing.

---

**That's it!** Your Aban Remit app will be live and ready to process real payments.