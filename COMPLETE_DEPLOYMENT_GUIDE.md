# Complete Edge Function Deployment Guide for Lovable

## 🚀 What's Ready for Deployment

### Edge Functions Created:
1. **`intasend-stk-push`** - M-Pesa STK Push (funding wallets)
2. **`intasend-b2c-withdraw`** - M-Pesa B2C withdrawals  
3. **`intasend-webhook`** - IntaSend webhook handler
4. **`fund-wallet`** - White-labeled Paystack integration (updated)

### Database Tables:
- `paystack_transactions` - Paystack payment tracking
- `intasend_transactions` - IntaSend payment tracking
- All with proper RLS policies and indexes

## 📋 Deployment Steps for Lovable

### Step 1: Deploy Database Schema
Run `EDGE_FUNCTION_TABLES.sql` in your Supabase SQL Editor to create all required tables.

### Step 2: Set Environment Variables
In your Supabase project settings, add these environment variables:

**Required for IntaSend:**
```
INTASEND_PUBLIC_KEY=your_intasend_public_key
INTASEND_SECRET_KEY=your_intasend_secret_key
```

**Required for Paystack (White-labeled):**
```
PAYSTACK_SECRET_KEY=your_paystack_secret_key
PAYSTACK_PUBLIC_KEY=your_paystack_public_key
PAYSTACK_SPLIT_CODE=your_split_code (optional)
PAYSTACK_SUBACCOUNT=your_subaccount (optional)
PAYSTACK_CUSTOM_LOGO_URL=your_logo_url (optional)
```

**Required for Supabase:**
```
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Step 3: Deploy Edge Functions
The following Edge Functions are ready in the `supabase/functions/` directory:

1. **intasend-stk-push/** - STK Push for M-Pesa funding
2. **intasend-b2c-withdraw/** - B2C for M-Pesa withdrawals
3. **intasend-webhook/** - Webhook handler for payment updates
4. **fund-wallet/** - White-labeled Paystack integration

### Step 4: Configure Webhooks

**IntaSend Webhook URL:**
```
https://your-project.supabase.co/functions/v1/intasend-webhook
```

**Paystack Webhook URL:**
```
https://your-project.supabase.co/functions/v1/fund-wallet
```

## 🎯 Features Included

### IntaSend Integration:
✅ **STK Push** - Real M-Pesa prompts on user phones
✅ **B2C Withdrawals** - Send money from wallets to M-Pesa
✅ **Webhook Processing** - Automatic wallet updates
✅ **Transaction Tracking** - Full audit trail
✅ **Error Handling** - Proper rollbacks and error messages

### Paystack Integration (White-labeled):
✅ **Custom Branding** - Your logo and colors
✅ **Multiple Channels** - Cards, bank transfers, USSD, QR codes
✅ **Revenue Splitting** - Optional subaccounts and splits
✅ **Webhook Processing** - Automatic wallet updates
✅ **Transaction Tracking** - Full payment history
✅ **Fee Management** - Transparent fee handling

### Security Features:
✅ **Row Level Security** - Users can only access their data
✅ **Authentication** - All functions require valid user sessions
✅ **Input Validation** - Proper validation and sanitization
✅ **Error Handling** - Secure error messages
✅ **Audit Trails** - Complete transaction logging

## 🧪 Testing Instructions

### Test M-Pesa STK Push:
1. Use a real Safaricom number (254XXXXXXXXX)
2. Test with small amounts (10-50 KSh)
3. Check phone for STK push prompt
4. Verify wallet balance updates

### Test Paystack Payments:
1. Use test card numbers from Paystack docs
2. Test different payment channels
3. Verify webhook processing
4. Check transaction records

### Test Withdrawals:
1. Ensure wallet has sufficient balance
2. Test M-Pesa B2C withdrawals
3. Verify balance deductions
4. Check transaction history

## 🔧 Configuration Options

### White-label Customization:
- Set `PAYSTACK_CUSTOM_LOGO_URL` for your logo
- Configure `custom_title` and `custom_description`
- Set up subaccounts for revenue splitting
- Customize payment channels

### IntaSend Configuration:
- Use live or sandbox credentials
- Configure webhook endpoints
- Set up transaction limits
- Customize payment narratives

## 📱 Frontend Integration

The frontend is already updated to use these Edge Functions:
- M-Pesa payments via `intasend-stk-push`
- Paystack payments via `fund-wallet`
- Real-time status updates
- Proper error handling

## 🚨 Important Notes

1. **Test thoroughly** with small amounts first
2. **Monitor logs** in Supabase Edge Function logs
3. **Set up webhooks** for automatic processing
4. **Use HTTPS** for all webhook URLs
5. **Keep API keys secure** in environment variables

## 🎉 Ready for Production

This is a **complete, production-ready** payment system with:
- Real M-Pesa STK Push integration
- White-labeled Paystack payments
- Automatic webhook processing
- Full transaction tracking
- Proper security measures
- Error handling and rollbacks

Deploy these Edge Functions and you'll have a fully functional payment system! 🚀