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
      case 'initialize_payment':
        return await initializePayment(payload, supabaseClient)
      
      case 'verify_payment':
        return await verifyPayment(payload, supabaseClient)
      
      case 'webhook':
        return await handleWebhook(payload, supabaseClient)
      
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
  } catch (error) {
    console.error('Fund Wallet Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function initializePayment(payload: any, supabaseClient: any) {
  const { email, amount, currency, wallet_id, user_id, channels, callback_url, card_data } = payload
  
  // White-labeled configuration
  const requestBody: any = {
    email,
    amount: amount * 100, // Paystack expects amount in kobo/cents
    currency,
    channels: channels || ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer'],
    metadata: {
      wallet_id,
      user_id,
      purpose: 'wallet_funding',
      custom_fields: [
        {
          display_name: "Wallet ID",
          variable_name: "wallet_id",
          value: wallet_id
        }
      ]
    },
    callback_url: callback_url || `${Deno.env.get('SUPABASE_URL')}/functions/v1/fund-wallet`,
    // White-label customization
    split_code: Deno.env.get('PAYSTACK_SPLIT_CODE'), // Optional: for revenue splitting
    subaccount: Deno.env.get('PAYSTACK_SUBACCOUNT'), // Optional: for subaccounts
    bearer: 'account', // Who bears Paystack charges
    // Custom branding
    custom_logo: Deno.env.get('PAYSTACK_CUSTOM_LOGO_URL'),
    custom_title: 'Fund Your Wallet',
    custom_description: 'Add money to your Swift Remit wallet securely'
  }

  // Add card data for inline payments if provided
  if (card_data) {
    requestBody.card = {
      number: card_data.number,
      cvv: card_data.cvv,
      expiry_month: card_data.expiry_month,
      expiry_year: card_data.expiry_year,
    }
  }

  const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('PAYSTACK_SECRET_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  const data = await paystackResponse.json()
  
  // Create payment record if initialization was successful
  if (data.status && data.data) {
    await supabaseClient
      .from('paystack_transactions')
      .insert({
        user_id,
        wallet_id,
        paystack_reference: data.data.reference,
        amount,
        currency,
        status: 'pending',
        access_code: data.data.access_code,
        authorization_url: data.data.authorization_url
      })
  }
  
  return new Response(
    JSON.stringify({
      success: data.status,
      data: {
        ...data.data,
        // White-labeled response
        payment_url: data.data.authorization_url,
        reference: data.data.reference,
        access_code: data.data.access_code
      }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function verifyPayment(payload: any, supabaseClient: any) {
  const { reference } = payload
  
  const paystackResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: {
      'Authorization': `Bearer ${Deno.env.get('PAYSTACK_SECRET_KEY')}`,
    },
  })

  const data = await paystackResponse.json()
  
  if (data.status && data.data.status === 'success') {
    const { wallet_id, user_id } = data.data.metadata
    const amount = data.data.amount / 100 // Convert from kobo/cents
    
    // Update payment record
    await supabaseClient
      .from('paystack_transactions')
      .update({
        status: 'success',
        paystack_transaction_id: data.data.id.toString(),
        payment_method: data.data.channel,
        gateway_response: data.data.gateway_response,
        paid_at: new Date(data.data.paid_at).toISOString(),
        fees: data.data.fees / 100, // Convert fees from kobo
        customer_code: data.data.customer?.customer_code
      })
      .eq('paystack_reference', reference)

    // Update wallet balance
    const { error: walletError } = await supabaseClient
      .from('wallets')
      .update({ 
        balance: supabaseClient.raw(`balance + ${amount}`),
        updated_at: new Date().toISOString()
      })
      .eq('id', wallet_id)
      .eq('user_id', user_id)

    if (walletError) throw walletError

    // Create transaction record
    const { error: transactionError } = await supabaseClient
      .from('transactions')
      .insert({
        from_wallet_id: null,
        to_wallet_id: wallet_id,
        amount,
        currency: data.data.currency,
        transaction_type: 'deposit',
        status: 'completed',
        description: `Card/Bank funding via Paystack - ${reference}`,
        reference: data.data.reference,
        tx_hash: data.data.id.toString()
      })

    if (transactionError) throw transactionError

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: {
          amount,
          currency: data.data.currency,
          reference: data.data.reference,
          status: 'success',
          payment_method: data.data.channel,
          wallet_id,
          new_balance: null // Will be fetched separately if needed
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } else {
    // Update payment record as failed
    await supabaseClient
      .from('paystack_transactions')
      .update({
        status: 'failed',
        gateway_response: data.message || 'Payment failed',
      })
      .eq('paystack_reference', reference)

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: data.message || 'Payment verification failed'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function handleWebhook(payload: any, supabaseClient: any) {
  const event = payload.event
  const data = payload.data

  console.log('Paystack Webhook Event:', event)

  if (event === 'charge.success') {
    const { wallet_id, user_id } = data.metadata
    const amount = data.amount / 100

    // Update wallet balance
    await supabaseClient
      .from('wallets')
      .update({ 
        balance: supabaseClient.raw(`balance + ${amount}`),
        updated_at: new Date().toISOString()
      })
      .eq('id', wallet_id)
      .eq('user_id', user_id)

    // Create transaction record
    await supabaseClient
      .from('transactions')
      .insert({
        from_wallet_id: null,
        to_wallet_id: wallet_id,
        amount,
        currency: data.currency,
        transaction_type: 'deposit',
        status: 'completed',
        description: `Webhook funding via Paystack - ${data.reference}`,
        reference: data.reference,
        tx_hash: data.id.toString()
      })

    // Update payment record
    await supabaseClient
      .from('paystack_transactions')
      .update({
        status: 'success',
        paystack_transaction_id: data.id.toString(),
        payment_method: data.channel,
        gateway_response: data.gateway_response,
        paid_at: new Date(data.paid_at).toISOString(),
        fees: data.fees / 100
      })
      .eq('paystack_reference', data.reference)
  }

  return new Response('OK', { headers: corsHeaders })
}