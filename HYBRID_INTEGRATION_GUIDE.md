# IntaSend + Paystack Hybrid Integration Guide

## Overview

This hybrid integration combines the best of both payment providers:

- **Paystack**: White-labeled card payments (funding) + Bank withdrawals
- **IntaSend**: M-Pesa funding, M-Pesa withdrawals, and wallet-to-wallet transfers

## 🚀 Quick Setup

### 1. Deploy SQL Functions

Run the SQL script in your Supabase SQL Editor:

```sql
-- Copy and paste the entire content of INTASEND_SQL_INTEGRATION_FIXED.sql
-- This creates all necessary tables and functions
```

### 2. Environment Variables

Your `.env.production` is already configured with live keys:

```env
# Paystack LIVE Keys (Cards & Bank)
VITE_PAYSTACK_PUBLIC_KEY="your_paystack_public_key"
PAYSTACK_SECRET_KEY="your_paystack_secret_key"

# IntaSend LIVE Keys (M-Pesa & Wallet Transfers)
VITE_INTASEND_PUBLIC_KEY="your_intasend_public_key"
INTASEND_SECRET_KEY="your_intasend_secret_key"
```

## 💳 Payment Methods by Currency

### KES Wallets (Full Support)
- **Fund Wallet**: 
  - ✅ Debit/Credit Cards (Paystack - White-labeled)
  - ✅ M-Pesa STK Push (IntaSend)
- **Withdraw Money**:
  - ✅ Bank Account (Paystack)
  - ✅ M-Pesa B2C (IntaSend)
- **Send Money**:
  - ✅ Wallet Transfer (Internal)

### NGN/USD/EUR Wallets (Paystack Only)
- **Fund Wallet**: 
  - ✅ Debit/Credit Cards (Paystack - White-labeled)
- **Withdraw Money**:
  - ✅ Bank Account (Paystack)
- **Send Money**:
  - ✅ Wallet Transfer (Internal)

## 🔧 Component Usage

### Main Payment Interface

Use the `PaymentManager` component in your wallet pages:

```tsx
import PaymentManager from '@/components/PaymentManager';

// In your wallet page
<PaymentManager 
  wallet={selectedWallet} 
  onSuccess={() => {
    // Refresh wallet data
    refetchWallets();
  }} 
/>
```

### Individual Components

For specific payment methods:

```tsx
// Card payments (Paystack)
<PaystackPayment 
  wallet={wallet} 
  mode="fund" 
  isOpen={isOpen} 
  onClose={onClose} 
  onSuccess={onSuccess} 
/>

// M-Pesa funding (IntaSend)
<MpesaPaymentForm 
  wallet={wallet} 
  isOpen={isOpen} 
  onClose={onClose} 
  onSuccess={onSuccess} 
/>

// M-Pesa withdrawals (IntaSend)
<MpesaWithdrawForm 
  wallet={wallet} 
  isOpen={isOpen} 
  onClose={onClose} 
  onSuccess={onSuccess} 
/>

// Wallet transfers (Internal)
<WalletTransferForm 
  wallet={wallet} 
  isOpen={isOpen} 
  onClose={onClose} 
  onSuccess={onSuccess} 
/>
```

## 📊 Database Functions

### M-Pesa Funding
```sql
SELECT public.intasend_mpesa_fund_wallet(
  'wallet-uuid',
  '254712345678',
  1000
);
```

### M-Pesa Withdrawal
```sql
SELECT public.intasend_mpesa_withdraw(
  'wallet-uuid',
  '254712345678',
  500,
  'John Doe'
);
```

### Wallet Transfer
```sql
SELECT public.intasend_wallet_transfer(
  'from-wallet-uuid',
  'WLT-ABC123',
  250,
  'Payment for services'
);
```

### Update Transaction Status
```sql
SELECT public.update_intasend_transaction_status(
  'transaction-uuid',
  'completed',
  '{"intasend_id": "12345"}'::jsonb
);
```

## 🔄 Transaction Flow

### M-Pesa Funding Flow
1. User enters amount and phone number
2. `intasend_mpesa_fund_wallet()` creates pending transaction
3. Frontend calls IntaSend STK Push API (using returned payload)
4. User completes payment on phone
5. Webhook/polling updates status via `update_intasend_transaction_status()`
6. Wallet balance updated automatically

### M-Pesa Withdrawal Flow
1. User enters amount, phone, and recipient name
2. `intasend_mpesa_withdraw()` deducts balance immediately
3. Frontend calls IntaSend B2C API (using returned payload)
4. Money sent to recipient's M-Pesa
5. Transaction marked as completed

### Wallet Transfer Flow
1. User enters recipient wallet number and amount
2. `intasend_wallet_transfer()` processes transfer immediately
3. Both sender and receiver balances updated
4. Transaction records created for both parties

## 🛡️ Security Features

- **Row Level Security (RLS)**: Users can only access their own transactions
- **Input Validation**: Phone numbers, amounts, and wallet numbers validated
- **Balance Checks**: Insufficient balance prevented
- **Rollback Protection**: Failed transactions automatically rolled back
- **Authentication**: All functions require authenticated users

## 📱 Frontend Integration

### Payment Method Detection
The system automatically detects available payment methods based on wallet currency:

```tsx
// KES wallet shows: Cards, M-Pesa, Bank withdrawals, M-Pesa withdrawals
// NGN wallet shows: Cards, Bank withdrawals  
// USD/EUR wallet shows: Cards, Bank withdrawals
```

### Error Handling
All functions return standardized JSON responses:

```json
{
  "success": true/false,
  "message": "Human readable message",
  "error": "Error details if failed",
  "transaction_id": "uuid",
  "new_balance": 1000.00
}
```

## 🔍 Testing

### Test M-Pesa Integration
1. Use IntaSend test credentials for development
2. Test phone numbers: 254700000000 - 254700000010
3. All test transactions auto-complete

### Test Paystack Integration
1. Use Paystack test cards for development
2. Test card: 4084084084084081 (Visa)
3. Any future expiry date and CVV

## 📈 Monitoring

### Transaction Tables
- `intasend_transactions`: IntaSend-specific transactions
- `transactions`: Main transaction log
- `payments`: Paystack payment records
- `withdrawals`: Withdrawal records

### Key Metrics to Monitor
- Success rates by payment method
- Average transaction amounts
- Failed transaction reasons
- User adoption by currency

## 🚨 Important Notes

1. **Live Keys**: You're using live API keys - real money transactions
2. **Fees**: M-Pesa withdrawals include 10 KES fee
3. **Currency**: M-Pesa only works with KES wallets
4. **Validation**: Phone numbers must be in 254XXXXXXXXX format
5. **Webhooks**: Set up IntaSend webhooks for real-time status updates

## 🔗 API Documentation

- [IntaSend API Docs](https://developers.intasend.com/)
- [Paystack API Docs](https://paystack.com/docs/api/)
- [Supabase Functions](https://supabase.com/docs/guides/database/functions)

## 🆘 Troubleshooting

### Common Issues
1. **"Wallet not found"**: Check user authentication and wallet ownership
2. **"Invalid phone format"**: Ensure 254XXXXXXXXX format
3. **"Insufficient balance"**: Include fees in balance calculations
4. **"Currency mismatch"**: M-Pesa only supports KES

### Debug Queries
```sql
-- Check transaction status
SELECT * FROM intasend_transactions WHERE user_id = auth.uid();

-- Check wallet balance
SELECT * FROM wallets WHERE user_id = auth.uid();

-- Check recent transactions
SELECT * FROM transactions WHERE user_id = auth.uid() ORDER BY created_at DESC;
```

This hybrid integration provides a complete payment solution with multiple funding and withdrawal options while maintaining security and user experience.