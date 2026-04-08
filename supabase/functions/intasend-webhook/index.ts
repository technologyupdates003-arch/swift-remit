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

    const webhookData = await req.json()
    console.log('IntaSend Webhook received:', webhookData)

    // Handle different webhook events
    const { invoice, state, api_ref, amount, currency, phone_number } = webhookData

    if (!api_ref) {
      console.log('No api_ref in webhook, skipping')
      return new Response('OK', { headers: corsHeaders })
    }

    // Find the transaction by api_ref (transaction ID)
    const { data: transaction, error: txError } = await supabaseClient
      .from('intasend_transactions')
      .select('*')
      .eq('id', api_ref)
      .single()

    if (txError || !transaction) {
      console.log('Transaction not found for api_ref:', api_ref)
      return new Response('Transaction not found', { 
        status: 404, 
        headers: corsHeaders 
      })
    }

    // Update transaction status based on webhook state
    let newStatus = 'pending'
    let shouldUpdateWallet = false

    switch (state) {
      case 'COMPLETE':
      case 'COMPLETED':
        newStatus = 'completed'
        shouldUpdateWallet = transaction.transaction_type === 'fund'
        break
      case 'FAILED':
      case 'CANCELLED':
        newStatus = 'failed'
        break
      case 'PROCESSING':
        newStatus = 'processing'
        break
      default:
        newStatus = 'pending'
    }

    // Update transaction status
    await supabaseClient
      .from('intasend_transactions')
      .update({
        status: newStatus,
        intasend_transaction_id: invoice?.invoice_id || webhookData.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', api_ref)

    // Update wallet balance if funding was successful
    if (shouldUpdateWallet && newStatus === 'completed') {
      const { error: walletError } = await supabaseClient
        .from('wallets')
        .update({
          balance: supabaseClient.raw(`balance + ${transaction.amount}`),
          updated_at: new Date().toISOString()
        })
        .eq('id', transaction.wallet_id)

      if (walletError) {
        console.error('Failed to update wallet balance:', walletError)
      } else {
        // Create successful transaction record
        await supabaseClient
          .from('transactions')
          .insert({
            from_wallet_id: null,
            to_wallet_id: transaction.wallet_id,
            amount: transaction.amount,
            currency: transaction.currency,
            transaction_type: 'deposit',
            status: 'completed',
            description: `M-Pesa funding via IntaSend - ${api_ref}`
          })

        console.log(`Wallet ${transaction.wallet_id} credited with ${transaction.amount} ${transaction.currency}`)
      }
    }

    return new Response('OK', { headers: corsHeaders })

  } catch (error) {
    console.error('IntaSend Webhook Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})