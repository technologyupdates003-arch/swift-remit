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
    console.log('=== INTASEND WEBHOOK HANDLER ===')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const webhookPayload = await req.json()
    console.log('Webhook received:', JSON.stringify(webhookPayload))

    // Handle webhook challenge/verification
    if (webhookPayload.challenge) {
      return new Response(JSON.stringify({
        challenge: 'aban_remit_webhook_2024_secure'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { api_ref, state, account } = webhookPayload

    if (!api_ref) {
      console.log('No api_ref in webhook, skipping')
      return new Response('OK', { status: 200, headers: corsHeaders })
    }

    // Process via database function (atomic wallet update)
    const { data: result, error } = await supabase
      .rpc('handle_payment_webhook', {
        p_api_ref: api_ref,
        p_state: state || 'pending',
        p_webhook_data: webhookPayload,
      })

    console.log('Webhook processing result:', JSON.stringify(result))

    if (error) {
      console.error('RPC error:', error)
    }

    // Send SMS on successful payment
    if (result?.success && ['completed', 'success', 'complete'].includes((state || '').toLowerCase())) {
      try {
        const microserviceUrl = Deno.env.get('PAYMENT_MICROSERVICE_URL')
        const microserviceKey = Deno.env.get('PAYMENT_MICROSERVICE_KEY')

        if (microserviceUrl && microserviceKey) {
          await fetch(`${microserviceUrl}/talksasa-integration`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${microserviceKey}`,
            },
            body: JSON.stringify({
              action: 'send_sms',
              phone_number: account || webhookPayload.phone_number || '254700000000',
              message: `Payment successful! KSh${result.amount_added} added to your AbanRemit wallet. New balance: KSh${result.new_balance}. Ref: ${api_ref}`,
              sender_id: 'ABAN_COOL',
            })
          })
          console.log('SMS notification sent')
        }
      } catch (smsError) {
        console.error('SMS notification error:', smsError)
      }
    }

    return new Response('OK', { status: 200, headers: corsHeaders })

  } catch (error) {
    console.error('Webhook handler error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
