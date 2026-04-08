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

    const { phone_number, amount, narrative, api_ref, wallet_id } = await req.json()

    // Get IntaSend credentials from environment
    const intasendPublicKey = Deno.env.get('INTASEND_PUBLIC_KEY')
    const intasendSecretKey = Deno.env.get('INTASEND_SECRET_KEY')

    if (!intasendPublicKey || !intasendSecretKey) {
      throw new Error('IntaSend credentials not configured')
    }

    // Create authorization header
    const credentials = btoa(`${intasendPublicKey}:${intasendSecretKey}`)
    
    // Call IntaSend STK Push API
    const intasendResponse = await fetch('https://payment.intasend.com/api/v1/payment/mpesa-stk-push/', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone_number,
        amount,
        narrative: narrative || 'Wallet funding',
        api_ref: api_ref || `WLT-${Date.now()}`
      })
    })

    if (!intasendResponse.ok) {
      const errorData = await intasendResponse.json()
      throw new Error(errorData.detail || 'STK Push failed')
    }

    const result = await intasendResponse.json()

    // Update transaction status in database
    if (wallet_id && api_ref) {
      await supabaseClient
        .from('intasend_transactions')
        .update({
          intasend_transaction_id: result.invoice?.invoice_id || result.id,
          status: 'sent',
          updated_at: new Date().toISOString()
        })
        .eq('id', api_ref)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: result,
        message: 'STK Push sent successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('IntaSend STK Push Error:', error)
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