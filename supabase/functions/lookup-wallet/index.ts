import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { wallet_id, sender_user_id } = await req.json();
    if (!wallet_id) {
      return new Response(JSON.stringify({ success: false, message: 'Wallet ID required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: wallet } = await supabase
      .from('wallets')
      .select('*, users!inner(id, full_name, phone)')
      .eq('wallet_number', wallet_id)
      .eq('status', 'active')
      .maybeSingle();

    if (!wallet) {
      return new Response(JSON.stringify({ success: false, message: 'Wallet not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404,
      });
    }

    if (wallet.user_id === sender_user_id) {
      return new Response(JSON.stringify({ success: false, message: 'You cannot send money to your own wallet' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      });
    }

    const user = (wallet as any).users;
    return new Response(JSON.stringify({
      success: true,
      recipient: {
        full_name: user.full_name || 'Unknown',
        phone: user.phone,
        wallet_id: wallet.wallet_number,
        currency: wallet.currency,
        status: wallet.status,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Lookup error:', error);
    return new Response(JSON.stringify({ success: false, message: 'Server error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    });
  }
});
