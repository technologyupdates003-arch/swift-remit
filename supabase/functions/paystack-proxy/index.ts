import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const secretKey = Deno.env.get('PAYSTACK_SECRET_KEY')
    if (!secretKey) {
      return json({ status: false, message: 'Paystack not configured' }, 500)
    }

    const { action, ...payload } = await req.json()

    const paystackHeaders = {
      'Authorization': `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    }

    switch (action) {
      case 'initialize': {
        const response = await fetch('https://api.paystack.co/transaction/initialize', {
          method: 'POST',
          headers: paystackHeaders,
          body: JSON.stringify({
            email: payload.email,
            amount: payload.amount,
            currency: payload.currency,
            reference: payload.reference,
            callback_url: payload.callback_url,
            metadata: payload.metadata,
          }),
        })
        const data = await response.json()
        return json(data)
      }

      case 'verify': {
        const response = await fetch(
          `https://api.paystack.co/transaction/verify/${encodeURIComponent(payload.reference)}`,
          { method: 'GET', headers: paystackHeaders }
        )
        const data = await response.json()
        return json(data)
      }

      case 'list_banks': {
        const currency = payload.currency || 'NGN'
        const response = await fetch(
          `https://api.paystack.co/bank?currency=${currency}`,
          { method: 'GET', headers: paystackHeaders }
        )
        const data = await response.json()
        return json(data)
      }

      case 'resolve_account': {
        const response = await fetch(
          `https://api.paystack.co/bank/resolve?account_number=${payload.account_number}&bank_code=${payload.bank_code}`,
          { method: 'GET', headers: paystackHeaders }
        )
        const data = await response.json()
        return json(data)
      }

      case 'create_recipient': {
        const response = await fetch('https://api.paystack.co/transferrecipient', {
          method: 'POST',
          headers: paystackHeaders,
          body: JSON.stringify({
            type: payload.type || 'nuban',
            name: payload.name,
            account_number: payload.account_number,
            bank_code: payload.bank_code,
            currency: payload.currency || 'NGN',
          }),
        })
        const data = await response.json()
        return json(data)
      }

      case 'initiate_transfer': {
        const response = await fetch('https://api.paystack.co/transfer', {
          method: 'POST',
          headers: paystackHeaders,
          body: JSON.stringify({
            source: 'balance',
            amount: payload.amount,
            recipient: payload.recipient,
            reason: payload.reason || 'Wallet withdrawal',
            reference: payload.reference,
          }),
        })
        const data = await response.json()
        return json(data)
      }

      default:
        return json({ status: false, message: 'Invalid action' }, 400)
    }
  } catch (error) {
    console.error('Paystack Proxy Error:', error)
    return json({ status: false, message: error.message }, 500)
  }
})