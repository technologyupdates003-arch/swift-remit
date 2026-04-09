import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Validate caller is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const body = await req.json()
    const { action, ...payload } = body

    // Get microservice credentials from secrets
    const microserviceUrl = Deno.env.get('PAYMENT_MICROSERVICE_URL')
    const microserviceKey = Deno.env.get('PAYMENT_MICROSERVICE_KEY')

    if (!microserviceUrl || !microserviceKey) {
      throw new Error('Payment microservice not configured')
    }

    if (action === 'mpesa_stk_push') {
      const response = await fetch(`${microserviceUrl}/mpesa-stk-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': microserviceKey,
          'Authorization': `Bearer ${microserviceKey}`,
        },
        body: JSON.stringify({
          api_ref: payload.api_ref,
          external_user_id: payload.external_user_id,
          external_wallet_id: payload.external_wallet_id,
          phone_number: payload.phone_number,
          amount: payload.amount,
          currency: payload.currency || 'KES',
          narrative: payload.narrative || 'AbanRemit wallet funding',
        })
      })

      if (!response.ok) {
        const errText = await response.text()
        console.error('Microservice error:', errText)
        throw new Error(`Payment service returned ${response.status}`)
      }

      const result = await response.json()
      return new Response(JSON.stringify({ success: true, ...result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ success: false, error: 'Unknown action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Proxy error:', error)
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
