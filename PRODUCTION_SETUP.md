# Aban Remit Production Setup Guide

Complete setup guide for deploying Aban Remit to production using Supabase hosting with live Paystack integration.

## 🔑 Environment Variables Setup

### 1. Local Development (.env)
```env
# Supabase Configuration
VITE_SUPABASE_PROJECT_ID="swisiaxjxvuqkcjkxcnm"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3aXNpYXhqeHZ1cWtjamt4Y25tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MTU0OTksImV4cCI6MjA5MDk5MTQ5OX0.vFKugq0S9FAGo4zVlMQ5QY_ClOu0s9YCXwNWt04kknY"
VITE_SUPABASE_URL="https://swisiaxjxvuqkcjkxcnm.supabase.co"

# Paystack LIVE Keys
VITE_PAYSTACK_PUBLIC_KEY="pk_live_your_actual_live_public_key_here"
PAYSTACK_SECRET_KEY="sk_live_your_actual_live_secret_key_here"

# App Configuration
VITE_APP_NAME="Aban Remit"
NODE_ENV="production"
```

### 2. Supabase Edge Functions Environment Variables

Set these in your Supabase Dashboard (Settings → Edge Functions):

```
PAYSTACK_SECRET_KEY=sk_live_your_actual_live_secret_key_here
```

## 🔗 Paystack Configuration

### 1. Webhook URLs

Configure these webhooks in your Paystack Dashboard (Settings → API Keys & Webhooks):

#### Primary Webhook (Fund Wallet)
```
URL: https://swisiaxjxvuqkcjkxcnm.supabase.co/functions/v1/fund-wallet
Method: POST
Events: charge.success, charge.failed
```

#### Secondary Webhook (Withdrawals)
```
URL: https://swisiaxjxvuqkcjkxcnm.supabase.co/functions/v1/withdraw-to-bank
Method: POST
Events: transfer.success, transfer.failed, transfer.reversed
```

### 2. Callback URLs

These are automatically configured based on your deployment:

#### For Supabase Hosting
```
https://swisiaxjxvuqkcjkxcnm.supabase.co/payment-success
```

#### For Custom Domain (if you add one later)
```
https://your-domain.com/payment-success
```

### 3. Allowed Domains

Add these domains to your Paystack settings:

```
https://swisiaxjxvuqkcjkxcnm.supabase.co
https://*.supabase.co
localhost:5173 (for development)
```

## 🚀 Deployment Steps

### Step 1: Deploy Edge Functions
```bash
# Login to Supabase (if not already logged in)
supabase login

# Deploy functions
supabase functions deploy fund-wallet
supabase functions deploy withdraw-to-bank

# Set environment variables
supabase secrets set PAYSTACK_SECRET_KEY=sk_live_your_actual_live_secret_key_here
```

### Step 2: Run Database Migrations
```bash
# Apply all migrations
supabase db push
```

### Step 3: Deploy Frontend to Supabase

#### Option A: Using Supabase CLI (Recommended)
```bash
# Build the application
npm run build

# Deploy to Supabase hosting
supabase hosting deploy
```

#### Option B: Manual Upload
1. Build your application: `npm run build`
2. Go to Supabase Dashboard → Storage → Create bucket named 'website'
3. Upload the contents of your `dist` folder
4. Enable public access on the bucket

### Step 4: Configure Custom Domain (Optional)

If you want to use abanremit.com later:
1. Go to Supabase Dashboard → Settings → Custom Domains
2. Add your domain: abanremit.com
3. Follow DNS configuration instructions
4. Update Paystack allowed domains

## 🔒 Security Checklist

### Environment Variables
- [ ] Live Paystack keys are set correctly in Supabase
- [ ] Secret keys are not exposed in frontend code
- [ ] All environment variables are configured
- [ ] `.env` files are in `.gitignore`

### Paystack Configuration
- [ ] Webhooks are configured with Supabase URLs
- [ ] Live mode is enabled in Paystack dashboard
- [ ] Supabase domains are in allowed domains list
- [ ] Test transactions work in live mode

### Supabase Security
- [ ] Row Level Security (RLS) is enabled on all tables
- [ ] API keys are properly configured
- [ ] Edge function secrets are set
- [ ] Database policies are working correctly

## 📱 Testing in Production

### Test Card Payments
Use these live test cards (small amounts):

```
Successful Payment: 4084084084084081
CVV: Any 3 digits
Expiry: Any future date
```

### Test Bank Transfers
Use real Nigerian bank accounts with small amounts (₦100-500)

### Test Withdrawals
1. Fund wallet with small amount
2. Add real bank account
3. Withdraw small amount (₦100-500)
4. Verify funds arrive in bank account

## 🎯 Go-Live Checklist

### Pre-Launch
- [ ] All environment variables configured in Supabase
- [ ] Edge functions deployed and working
- [ ] Database migrations applied
- [ ] Frontend deployed to Supabase hosting
- [ ] SSL certificate active (automatic with Supabase)
- [ ] Paystack webhooks configured with Supabase URLs
- [ ] Test transactions successful

### Launch Day
- [ ] Monitor Supabase Edge Function logs
- [ ] Monitor Paystack dashboard
- [ ] Test all payment flows
- [ ] Verify webhook deliveries
- [ ] Check transaction records in database

### Post-Launch
- [ ] Set up monitoring alerts
- [ ] Configure backup procedures
- [ ] Document support procedures
- [ ] Train support team on transaction flows

## 🆘 Troubleshooting

### Common Issues

1. **"Invalid public key"**
   - Check VITE_PAYSTACK_PUBLIC_KEY is set correctly
   - Ensure using live key (pk_live_...)

2. **"Webhook not received"**
   - Verify webhook URL: `https://swisiaxjxvuqkcjkxcnm.supabase.co/functions/v1/fund-wallet`
   - Check Supabase Edge Function logs
   - Ensure webhook events are selected in Paystack

3. **"Payment successful but wallet not credited"**
   - Check webhook delivery in Paystack dashboard
   - Verify database transaction records
   - Check Supabase Edge Function logs

4. **"Withdrawal failed"**
   - Verify bank account details
   - Check Paystack transfer logs
   - Ensure sufficient balance in Paystack account

### Useful Commands

```bash
# View Edge Function logs
supabase functions logs fund-wallet

# View database logs
supabase logs

# Check function status
supabase functions list
```

## 📊 Your Production URLs

### Application URL
```
https://swisiaxjxvuqkcjkxcnm.supabase.co
```

### API Endpoints
```
Fund Wallet: https://swisiaxjxvuqkcjkxcnm.supabase.co/functions/v1/fund-wallet
Withdraw: https://swisiaxjxvuqkcjkxcnm.supabase.co/functions/v1/withdraw-to-bank
```

### Webhook URLs for Paystack
```
https://swisiaxjxvuqkcjkxcnm.supabase.co/functions/v1/fund-wallet
https://swisiaxjxvuqkcjkxcnm.supabase.co/functions/v1/withdraw-to-bank
```

## 🎉 Quick Start Commands

```bash
# Complete deployment in one go
supabase login
supabase functions deploy fund-wallet
supabase functions deploy withdraw-to-bank
supabase secrets set PAYSTACK_SECRET_KEY=sk_live_your_key_here
supabase db push
npm run build
supabase hosting deploy
```

---

**Your app will be live at**: `https://swisiaxjxvuqkcjkxcnm.supabase.co`

**Important**: Always test with small amounts first before processing large transactions in production!