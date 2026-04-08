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

    const { 
      user_id, 
      phone_number, 
      message, 
      sms_type, 
      reference_id,
      charge_fee = true 
    } = await req.json()

    // Get TalkSasa configuration
    const talksasaBaseUrl = Deno.env.get('TALKSASA_BASE_URL') || 'https://bulksms.talksasa.co'
    const talksasaApiToken = Deno.env.get('TALKSASA_API_TOKEN')
    const talksasaDefaultSenderId = Deno.env.get('TALKSASA_DEFAULT_SENDER_ID') || 'ABAN_COOL'

    if (!talksasaApiToken) {
      throw new Error('TalkSasa API token not configured')
    }

    let smsLogId: string | null = null
    let feeCharged = 0

    // Charge SMS fee if requested
    if (charge_fee && user_id) {
      const { data: feeResult, error: feeError } = await supabaseClient.rpc('send_sms_with_fee', {
        p_user_id: user_id,
        p_phone_number: phone_number,
        p_message: message,
        p_sms_type: sms_type,
        p_reference_id: reference_id
      })

      if (feeError) {
        console.error('Fee charging error:', feeError)
        // Continue with SMS sending even if fee charging fails
      } else if (feeResult?.success) {
        smsLogId = feeResult.sms_log_id
        feeCharged = feeResult.fee_charged
      }
    }

    // Send SMS via TalkSasa
    const smsPayload = {
      message: message,
      recipients: [phone_number],
      sender_id: talksasaDefaultSenderId,
      callback_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/sms-webhook`
    }

    const talksasaResponse = await fetch(`${talksasaBaseUrl}/api/v1/sms/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${talksasaApiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(smsPayload)
    })

    const talksasaResult = await talksasaResponse.json()

    // Update SMS log with TalkSasa response
    if (smsLogId) {
      await supabaseClient
        .from('sms_log')
        .update({
          talksasa_response: talksasaResult,
          status: talksasaResponse.ok ? 'sent' : 'failed'
        })
        .eq('id', smsLogId)
    } else if (user_id) {
      // Create SMS log entry if fee wasn't charged
      await supabaseClient
        .from('sms_log')
        .insert({
          user_id,
          phone_number,
          message,
          sms_type,
          cost: 0,
          currency: 'KES',
          reference_id,
          talksasa_response: talksasaResult,
          status: talksasaResponse.ok ? 'sent' : 'failed'
        })
    }

    if (!talksasaResponse.ok) {
      throw new Error(talksasaResult.message || 'Failed to send SMS via TalkSasa')
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: talksasaResult,
        fee_charged: feeCharged,
        sms_log_id: smsLogId,
        message: 'SMS sent successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('SMS sending error:', error)
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