import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { phone_number, amount, wallet_id, user_id, narrative } = await req.json()

    // Get IntaSend credentials
    const intasendPublicKey = Deno.env.get('INTASEND_PUBLIC_KEY')
    const intasendSecretKey = Deno.env.get('INTASEND_SECRET_KEY')

    if (!intasendPublicKey || !intasendSecretKey) {
      throw new Error('IntaSend credentials not configured')
    }

    // Verify wallet ownership and balance
    const { data: wallet, error: walletError } = await supabaseClient
      .from('wallets')
      .select('balance, currency, user_id')
      .eq('id', wallet_id)
      .eq('user_id', user_id)
      .single()

    if (walletError || !wallet) {
      throw new Error('Wallet not found or access denied')
    }

    if (wallet.balance < amount) {
      throw new Error('Insufficient wallet balance')
    }

    if (wallet.currency !== 'KES') {
      throw new Error('M-Pesa withdrawals only available for KES wallets')
    }

    // Deduct amount from wallet first
    const { error: deductError } = await supabaseClient
      .from('wallets')
      .update({ 
        balance: wallet.balance - amount,
        updated_at: new Date().toISOString()
      })
      .eq('id', wallet_id)

    if (deductError) {
      throw new Error('Failed to deduct amount from wallet')
    }

    // Create authorization header
    const credentials = btoa(`${intasendPublicKey}:${intasendSecretKey}`)
    
    // Call IntaSend B2C API
    const intasendResponse = await fetch('https://payment.intasend.com/api/v1/send-money/mpesa/', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transactions: [{
          name: 'Wallet Withdrawal',
          account: phone_number,
          amount: amount,
          narrative: narrative || 'Wallet withdrawal'
        }],
        currency: 'KES',
        requires_approval: 'NO'
      })
    })

    if (!intasendResponse.ok) {
      // Refund wallet if B2C fails
      await supabaseClient
        .from('wallets')
        .update({ 
          balance: wallet.balance,
          updated_at: new Date().toISOString()
        })
        .eq('id', wallet_id)

      const errorData = await intasendResponse.json()
      throw new Error(errorData.detail || 'B2C withdrawal failed')
    }

    const result = await intasendResponse.json()

    // Create withdrawal transaction record
    await supabaseClient
      .from('intasend_transactions')
      .insert({
        wallet_id,
        user_id,
        phone_number,
        amount,
        currency: 'KES',
        transaction_type: 'withdraw',
        intasend_transaction_id: result.tracking_id || result.id,
        status: 'completed'
      })

    // Create transaction record
    await supabaseClient
      .from('transactions')
      .insert({
        from_wallet_id: wallet_id,
        to_wallet_id: null,
        amount,
        currency: 'KES',
        transaction_type: 'withdrawal',
        status: 'completed',
        description: `M-Pesa withdrawal to ${phone_number}`
      })

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: result,
        message: 'Withdrawal processed successfully',
        new_balance: wallet.balance - amount
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('IntaSend B2C Error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})