import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

async function getDarajaToken(): Promise<string> {
  const consumerKey = Deno.env.get('CONSUMER_KEY')!
  const consumerSecret = Deno.env.get('CONSUMER_SECRET')!
  const credentials = btoa(`${consumerKey}:${consumerSecret}`)

  const response = await fetch(
    'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    {
      method: 'GET',
      headers: { 'Authorization': `Basic ${credentials}` },
    }
  )

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Daraja auth failed: ${err}`)
  }

  const data = await response.json()
  return data.access_token
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { phone_number, amount, wallet_id, user_id, narrative } = await req.json()

    // Validate inputs
    if (!phone_number || !amount || !wallet_id || !user_id) {
      return json({ success: false, error: 'Missing required fields' }, 400)
    }

    if (amount < 10) {
      return json({ success: false, error: 'Minimum withdrawal is KSh 10' }, 400)
    }

    // Verify wallet ownership and balance
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('balance, currency, user_id')
      .eq('id', wallet_id)
      .eq('user_id', user_id)
      .single()

    if (walletError || !wallet) {
      return json({ success: false, error: 'Wallet not found or access denied' }, 400)
    }

    if (wallet.currency !== 'KES') {
      return json({ success: false, error: 'M-Pesa withdrawals only for KES wallets' }, 400)
    }

    if (wallet.balance < amount) {
      return json({ success: false, error: 'Insufficient balance' }, 400)
    }

    // Deduct amount from wallet first
    const { error: deductError } = await supabase
      .from('wallets')
      .update({
        balance: wallet.balance - amount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', wallet_id)

    if (deductError) {
      return json({ success: false, error: 'Failed to deduct from wallet' }, 500)
    }

    // Get Daraja token
    const token = await getDarajaToken()

    const shortcode = Deno.env.get('MPESA_SHORTCODE')!
    const initiatorName = Deno.env.get('MPESA_INITIATOR_NAME')!
    const securityCredential = Deno.env.get('SECURITY_CREDENTIAL')!

    // Call Daraja B2C API
    const b2cPayload = {
      OriginatorConversationID: `B2C-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
      InitiatorName: initiatorName,
      SecurityCredential: securityCredential,
      CommandID: 'BusinessPayment',
      Amount: amount,
      PartyA: shortcode,
      PartyB: phone_number,
      Remarks: narrative || 'AbanRemit wallet withdrawal',
      QueueTimeOutURL: `${Deno.env.get('SUPABASE_URL')}/functions/v1/universal-webhook?provider=daraja`,
      ResultURL: `${Deno.env.get('SUPABASE_URL')}/functions/v1/universal-webhook?provider=daraja`,
      Occasion: 'Withdrawal',
    }

    console.log('Daraja B2C request:', JSON.stringify(b2cPayload))

    const b2cResponse = await fetch('https://api.safaricom.co.ke/mpesa/b2c/v3/paymentrequest', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(b2cPayload),
    })

    const b2cResult = await b2cResponse.json()
    console.log('Daraja B2C response:', JSON.stringify(b2cResult))

    if (!b2cResponse.ok || b2cResult.errorCode) {
      // Refund wallet on failure
      await supabase
        .from('wallets')
        .update({
          balance: wallet.balance,
          updated_at: new Date().toISOString(),
        })
        .eq('id', wallet_id)

      return json({
        success: false,
        error: b2cResult.errorMessage || b2cResult.ResultDesc || 'B2C request failed',
      }, 400)
    }

    const conversationId = b2cResult.ConversationID || b2cResult.OriginatorConversationID || b2cPayload.OriginatorConversationID

    // Create transaction records
    await supabase.from('intasend_transactions').insert({
      wallet_id,
      user_id,
      phone_number,
      amount,
      currency: 'KES',
      transaction_type: 'withdraw',
      intasend_transaction_id: conversationId,
      intasend_response: b2cResult,
      status: 'pending',
      narrative: narrative || 'M-Pesa B2C withdrawal',
    })

    // Create payment_log for webhook tracking
    await supabase.from('payment_logs').insert({
      user_id,
      wallet_id,
      payment_type: 'daraja_b2c',
      amount,
      currency: 'KES',
      provider_reference: conversationId,
      status: 'pending',
      provider_response: b2cResult,
      metadata: {
        provider: 'daraja',
        phone_number,
        narrative: narrative || 'M-Pesa B2C withdrawal',
        balance_change_mode: 'no_balance_change',
      },
    })

    // Create main transaction record
    await supabase.from('transactions').insert({
      user_id,
      wallet_id,
      type: 'withdrawal',
      amount,
      currency: 'KES',
      status: 'pending',
      reference: `DARAJA-${conversationId}`,
      network: 'daraja',
    })

    // Send SMS notification
    try {
      await supabase.functions.invoke('send-sms-notification', {
        body: {
          phone_number,
          message: `Your M-Pesa withdrawal of KSh ${amount.toLocaleString()} is being processed. Ref: ${conversationId}`,
          sms_type: 'withdrawal',
          user_id,
          charge_fee: false,
        },
      })
    } catch (smsErr) {
      console.error('SMS notification error:', smsErr)
    }

    return json({
      success: true,
      message: 'M-Pesa withdrawal initiated',
      data: {
        conversation_id: conversationId,
        amount,
        phone_number,
      },
      new_balance: wallet.balance - amount,
    })
  } catch (error) {
    console.error('Daraja B2C Error:', error)
    return json({ success: false, error: error.message }, 500)
  }
})