import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { user_id, wallet_id, to_address, amount } = await req.json();
    if (!user_id || !wallet_id || !to_address || !amount || amount <= 0) {
      return new Response(JSON.stringify({ success: false, message: 'All fields required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: wallet } = await supabase.from('wallets').select('*').eq('id', wallet_id).eq('user_id', user_id).single();
    if (!wallet) {
      return new Response(JSON.stringify({ success: false, message: 'Wallet not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404,
      });
    }

    if (Number(wallet.balance) < amount) {
      return new Response(JSON.stringify({ success: false, message: 'Insufficient balance' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      });
    }

    // Deduct balance
    await supabase.from('wallets').update({ balance: Number(wallet.balance) - amount }).eq('id', wallet.id);

    // Record transaction
    const txHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
    await supabase.from('transactions').insert({
      user_id,
      wallet_id,
      type: 'withdrawal',
      amount,
      currency: wallet.currency,
      status: 'completed',
      reference: crypto.randomUUID(),
      tx_hash: txHash,
      network: wallet.currency === 'BTC' ? 'bitcoin' : 'ethereum',
    });

    return new Response(JSON.stringify({ success: true, message: 'Crypto sent', tx_hash: txHash }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Crypto send error:', error);
    return new Response(JSON.stringify({ success: false, message: 'Server error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    });
  }
});
