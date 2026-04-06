import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { user_id, from_wallet_id, to_wallet_id, amount } = await req.json();
    if (!user_id || !from_wallet_id || !to_wallet_id || !amount || amount <= 0) {
      return new Response(JSON.stringify({ success: false, message: 'All fields required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: fromWallet } = await supabase.from('wallets').select('*').eq('id', from_wallet_id).eq('user_id', user_id).single();
    const { data: toWallet } = await supabase.from('wallets').select('*').eq('id', to_wallet_id).eq('user_id', user_id).single();

    if (!fromWallet || !toWallet) {
      return new Response(JSON.stringify({ success: false, message: 'Wallet not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404,
      });
    }

    if (Number(fromWallet.balance) < amount) {
      return new Response(JSON.stringify({ success: false, message: 'Insufficient balance' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      });
    }

    // Get exchange rate
    const { data: rateData } = await supabase
      .from('exchange_rates')
      .select('rate')
      .eq('from_currency', fromWallet.currency)
      .eq('to_currency', toWallet.currency)
      .maybeSingle();

    if (!rateData) {
      return new Response(JSON.stringify({ success: false, message: 'Exchange rate not available' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      });
    }

    const convertedAmount = amount * rateData.rate;

    // Deduct from source
    await supabase.from('wallets').update({ balance: Number(fromWallet.balance) - amount }).eq('id', fromWallet.id);
    // Credit destination
    await supabase.from('wallets').update({ balance: Number(toWallet.balance) + convertedAmount }).eq('id', toWallet.id);

    // Record transaction
    await supabase.from('transactions').insert({
      user_id,
      wallet_id: fromWallet.id,
      sender_wallet_id: fromWallet.id,
      receiver_wallet_id: toWallet.id,
      type: 'exchange',
      amount,
      currency: fromWallet.currency,
      status: 'completed',
      reference: crypto.randomUUID(),
    });

    return new Response(JSON.stringify({
      success: true,
      message: `Exchanged ${fromWallet.currency} ${amount} → ${toWallet.currency} ${convertedAmount.toFixed(6)}`,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Exchange error:', error);
    return new Response(JSON.stringify({ success: false, message: 'Server error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    });
  }
});
