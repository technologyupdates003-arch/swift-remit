import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { phone } = await req.json();
    if (!phone || phone.length < 9) {
      return new Response(JSON.stringify({ success: false, message: 'Invalid phone number' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min

    // Save OTP
    await supabase.from('otp_codes').insert({
      phone,
      code,
      expires_at: expiresAt,
      purpose: 'login',
    });

    // Send via TalkSasa
    const TALKSASA_API_KEY = Deno.env.get('TALKSASA_API_KEY');
    if (TALKSASA_API_KEY) {
      try {
        await fetch('https://api.talksasa.com/v1/sms/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${TALKSASA_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: phone,
            message: `Your AbanRemit verification code is: ${code}. Valid for 5 minutes.`,
          }),
        });
      } catch (smsError) {
        console.error('SMS send error:', smsError);
      }
    } else {
      console.log(`[DEV] OTP for ${phone}: ${code}`);
    }

    return new Response(JSON.stringify({ success: true, message: 'OTP sent successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, message: 'Server error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    });
  }
});
