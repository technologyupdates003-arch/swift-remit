# Paystack Integration Setup Guide

This guide will help you set up Paystack integration for white-label wallet funding and bank withdrawals in your Swift Remit application.

## Prerequisites

1. A Paystack account (sign up at https://paystack.com)
2. Verified business account for live transactions
3. Access to your Paystack dashboard

## Setup Steps

### 1. Get Your Paystack Keys

1. Log into your Paystack dashboard
2. Navigate to Settings > API Keys & Webhooks
3. Copy your **Public Key** and **Secret Key**
4. For production, use the **Live** keys
5. For testing, use the **Test** keys

### 2. Update Environment Variables

Replace the placeholder values in your `.env` file:

```env
# Replace with your actual Paystack keys
VITE_PAYSTACK_PUBLIC_KEY="pk_live_your_actual_public_key_here"
PAYSTACK_SECRET_KEY="sk_live_your_actual_secret_key_here"
```

### 3. Deploy Supabase Edge Functions

Deploy both edge functions to your Supabase project:

```bash
supabase functions deploy fund-wallet
supabase functions deploy withdraw-to-bank
```

### 4. Set Environment Variables in Supabase

In your Supabase dashboard, go to Settings > Edge Functions and add:

```
PAYSTACK_SECRET_KEY=sk_live_your_actual_secret_key_here
```

### 5. Configure Webhook (Optional but Recommended)

1. In Paystack dashboard, go to Settings > API Keys & Webhooks
2. Add a new webhook URL: `https://your-project.supabase.co/functions/v1/fund-wallet`
3. Select events: `charge.success`, `charge.failed`
4. Save the webhook

### 6. Run Database Migrations

Apply the payments and withdrawals table migrations:

```bash
supabase db push
```

## White-Label Payment Experience

### Card Payments
- **Custom card form** - fully branded with your Swift Remit design
- **Real-time card validation** - instant feedback on card details
- **Card preview** - animated card display showing user input
- **Inline processing** - no redirects, seamless user experience
- **Security indicators** - SSL badges and security messaging

### Bank Transfers
- **Branded interface** - custom bank transfer flow
- **Account generation** - unique bank details for each transaction
- **Copy-to-clipboard** - easy account detail copying
- **Status tracking** - real-time transfer confirmation

## Supported Features

### Wallet Funding (White-Label)
- **Debit/Credit Cards** - Visa, Mastercard, Verve, Amex
- **Bank Transfer** - Nigerian banks only (NGN wallets)
- **No redirects** - all processing happens within your app
- **Custom branding** - fully matches your Swift Remit design

### Bank Withdrawals (White-Label)
- **NGN wallets only** - withdraw to Nigerian bank accounts
- **Multi-step flow** - amount entry, confirmation, processing
- **Real-time account verification** - instant bank account validation
- **Fee transparency** - clear breakdown of withdrawal fees
- **Multiple bank accounts** - save and manage multiple accounts
- **Instant processing** - funds arrive within 5-30 minutes
- **Professional UI** - fully branded withdrawal experience
- **Security features** - account verification and secure processing

## Currency Support

### Funding (White-Label)
- **KES** (Kenyan Shilling) - cards only
- **NGN** (Nigerian Naira) - cards and bank transfers
- **USD** (US Dollar) - international cards
- **EUR** (Euro) - international cards

### Withdrawals
- **NGN** (Nigerian Naira) - bank transfers only

## Testing

For testing, use Paystack's test cards:

- **Successful payment**: 4084084084084081
- **Insufficient funds**: 4084084084084081 (amount > 2500)
- **Failed payment**: 4084084084084081 (amount = 408)

For bank account verification testing, use:
- **Account Number**: 0123456789
- **Bank Code**: 044 (Access Bank)

## White-Label Features

### Card Form Features
- Real-time card number formatting
- Card type detection (Visa, Mastercard, etc.)
- Animated card preview
- Expiry date validation
- CVV security
- Custom styling with Swift Remit branding

### Bank Transfer Features
- Unique account generation
- One-click copy functionality
- Transfer instructions
- Status monitoring
- Custom branded interface

## Security Notes

1. Never expose your secret key in frontend code
2. All card data is processed securely through Paystack
3. No card details are stored on your servers
4. SSL encryption for all transactions
5. PCI DSS compliant processing

## Troubleshooting

### Common Issues

1. **"Invalid key"** - Check that you're using the correct environment (test/live)
2. **"Currency not supported"** - Ensure the currency is supported by Paystack
3. **"Paystack inline not loaded"** - Check internet connection and script loading
4. **"Account verification failed"** - Ensure account number and bank code are correct

### Support

- Paystack Documentation: https://paystack.com/docs
- Paystack Support: support@paystack.com
- Test your integration: https://paystack.com/docs/payments/test-payments

## Production Checklist

- [ ] Live Paystack keys configured
- [ ] Webhook URL set up and tested
- [ ] SSL certificate valid
- [ ] Database migrations applied
- [ ] Edge functions deployed
- [ ] White-label card form tested
- [ ] Bank transfer flow tested
- [ ] Withdrawal flow tested
- [ ] Error handling implemented
- [ ] Transaction logging working
- [ ] Custom branding applied