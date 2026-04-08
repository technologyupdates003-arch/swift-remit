# Swift Remit

A modern, secure money transfer and remittance platform built with React, TypeScript, and Supabase.

## Features

- 💸 **Send Money**: Fast international and domestic money transfers
- 💰 **Multi-Currency Wallets**: Support for multiple currencies
- 💳 **Wallet Funding**: Fund wallets via Paystack (Cards, Bank Transfer, M-Pesa)
- 🔄 **Currency Exchange**: Real-time exchange rates
- ₿ **Crypto Support**: Send and receive cryptocurrency
- 📱 **Mobile Responsive**: Works seamlessly on all devices
- 🔐 **Secure**: Bank-level security with KYC verification
- 📊 **Transaction History**: Complete transaction tracking
- 🔔 **Notifications**: Real-time transaction updates

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **UI Components**: Radix UI, shadcn/ui
- **Backend**: Supabase (Database, Auth, Edge Functions)
- **Payments**: Paystack (Cards, Bank Transfer, USSD, M-Pesa)
- **Build Tool**: Vite
- **Testing**: Vitest, Playwright

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   ```

3. Configure Paystack integration:
   - See [PAYSTACK_SETUP.md](./PAYSTACK_SETUP.md) for detailed setup instructions
   - Add your Paystack keys to `.env`

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Build for production:
   ```bash
   npm run build
   ```

## Payment Integration

The app features a **white-label payment experience** with Paystack integration:

### White-Label Card Payments
- **Custom card form** - fully branded Swift Remit interface
- **Real-time validation** - instant card number, expiry, and CVV validation
- **Card preview** - animated card display showing user input
- **No redirects** - seamless inline payment processing
- **Security indicators** - SSL badges and encryption messaging

### Bank Transfer (NGN only)
- **Branded interface** - custom bank transfer flow
- **Unique account generation** - dedicated account details per transaction
- **Copy functionality** - one-click copying of bank details
- **Status tracking** - real-time transfer confirmation

### Bank Withdrawals (White-Label)
- **NGN wallets only** - withdraw to Nigerian bank accounts
- **Multi-step flow** - amount entry, confirmation, processing states
- **Real-time verification** - instant bank account validation
- **Fee transparency** - clear breakdown of withdrawal costs
- **Multiple bank accounts** - save and manage multiple accounts
- **Instant processing** - funds arrive within 5-30 minutes
- **Professional interface** - fully branded withdrawal experience

Supported currencies for funding: KES, NGN, USD, EUR (cards), NGN (bank transfer)
Supported currencies for withdrawal: NGN only

## License

MIT
