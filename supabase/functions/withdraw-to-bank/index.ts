import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
  'Access-Control-Max-Age': '86400',
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

    const { action, ...payload } = await req.json()

    switch (action) {
      case 'create_recipient':
        return await createRecipient(payload)
      
      case 'initiate_transfer':
        return await initiateTransfer(payload, supabaseClient)
      
      case 'verify_account':
        return await verifyAccount(payload)
      
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function verifyAccount(payload: any) {
  const { account_number, bank_code } = payload
  
  const url = `https://api.paystack.co/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`
  
  const paystackResponse = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('PAYSTACK_SECRET_KEY')}`,
    },
  })

  const data = await paystackResponse.json()
  
  return new Response(
    JSON.stringify(data),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function createRecipient(payload: any) {
  const { name, account_number, bank_code, currency } = payload
  
  const paystackResponse = await fetch('https://api.paystack.co/transferrecipient', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('PAYSTACK_SECRET_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'nuban',
      name,
      account_number,
      bank_code,
      currency,
    }),
  })

  const data = await paystackResponse.json()
  
  return new Response(
    JSON.stringify(data),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function initiateTransfer(payload: any, supabaseClient: any) {
  const { amount, recipient_code, wallet_id, user_id, reason } = payload
  
  // Check wallet balance first
  const { data: wallet, error: walletError } = await supabaseClient
    .from('wallets')
    .select('balance, currency')
    .eq('id', wallet_id)
    .eq('user_id', user_id)
    .single()

  if (walletError || !wallet) {
    throw new Error('Wallet not found')
  }

  if (wallet.balance < amount) {
    throw new Error('Insufficient balance')
  }

  // Create transfer with Paystack
  const paystackResponse = await fetch('https://api.paystack.co/transfer', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('PAYSTACK_SECRET_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      source: 'balance',
      amount: amount * 100, // Convert to kobo/cents
      recipient: recipient_code,
      reason: reason || 'Wallet withdrawal',
    }),
  })

  const data = await paystackResponse.json()
  
  if (data.status) {
    // Deduct from wallet balance
    await supabaseClient
      .from('wallets')
      .update({ 
        balance: supabaseClient.raw(`balance - ${amount}`)
      })
      .eq('id', wallet_id)
      .eq('user_id', user_id)

    // Create withdrawal transaction record
    await supabaseClient
      .from('transactions')
      .insert({
        user_id,
        wallet_id,
        type: 'withdrawal',
        amount,
        currency: wallet.currency,
        status: 'pending',
        reference: data.data.reference,
        tx_hash: data.data.id.toString(),
      })

    // Create withdrawal record
    await supabaseClient
      .from('withdrawals')
      .insert({
        user_id,
        wallet_id,
        paystack_transfer_code: data.data.transfer_code,
        paystack_reference: data.data.reference,
        amount,
        currency: wallet.currency,
        recipient_code,
        status: 'pending',
      })
  }

  return new Response(
    JSON.stringify(data),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}