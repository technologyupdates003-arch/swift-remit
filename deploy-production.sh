#!/bin/bash

# Aban Remit Production Deployment Script (Supabase Hosting)
# Run this script to deploy to production using Supabase

echo "🚀 Deploying Aban Remit to Supabase Production..."

# Check if required environment variables are set
if [ -z "$PAYSTACK_SECRET_KEY" ]; then
    echo "❌ Error: PAYSTACK_SECRET_KEY environment variable not set"
    echo "Please set your live Paystack secret key:"
    echo "export PAYSTACK_SECRET_KEY=sk_live_your_actual_key"
    exit 1
fi

# Check if logged into Supabase
if ! supabase projects list &> /dev/null; then
    echo "❌ Error: Not logged into Supabase"
    echo "Please run: supabase login"
    exit 1
fi

# Deploy Supabase functions
echo "🔧 Deploying Supabase Edge Functions..."
supabase functions deploy fund-wallet
supabase functions deploy withdraw-to-bank

# Set Supabase secrets
echo "🔐 Setting Supabase secrets..."
supabase secrets set PAYSTACK_SECRET_KEY=$PAYSTACK_SECRET_KEY

# Apply database migrations
echo "🗄️ Applying database migrations..."
supabase db push

# Build the application
echo "📦 Building application..."
npm run build

# Deploy to Supabase hosting
echo "🌐 Deploying to Supabase hosting..."
supabase hosting deploy

echo "✅ Deployment complete!"
echo ""
echo "🔗 Your app is now live at:"
echo "   https://swisiaxjxvuqkcjkxcnm.supabase.co"
echo ""
echo "🔗 Configure these Paystack webhooks:"
echo "   https://swisiaxjxvuqkcjkxcnm.supabase.co/functions/v1/fund-wallet"
echo "   https://swisiaxjxvuqkcjkxcnm.supabase.co/functions/v1/withdraw-to-bank"
echo ""
echo "📊 Monitor your app:"
echo "   - Supabase Dashboard: https://supabase.com/dashboard/project/swisiaxjxvuqkcjkxcnm"
echo "   - Paystack Dashboard: https://dashboard.paystack.com"