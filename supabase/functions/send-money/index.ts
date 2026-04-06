import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { encode as encodeHex } from "https://deno.land/std@0.168.0/encoding/hex.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return new TextDecoder().decode(encodeHex(new Uint8Array(hash)));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { sender_user_id, sender_wallet_id, receiver_wallet_id, amount, pin } = await req.json();

    if (!sender_user_id || !sender_wallet_id || !receiver_wallet_id || !amount || !pin) {
      return new Response(JSON.stringify({ success: false, message: 'All fields required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      });
    }

    if (amount <= 0) {
      return new Response(JSON.stringify({ success: false, message: 'Amount must be positive' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify PIN
    const { data: senderUser } = await supabase
      .from('users')
      .select('pin_hash, failed_pin_attempts, pin_locked_until')
      .eq('id', sender_user_id)
      .single();

    if (!senderUser) {
      return new Response(JSON.stringify({ success: false, message: 'User not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404,
      });
    }

    // Check if locked
    if (senderUser.pin_locked_until && new Date(senderUser.pin_locked_until) > new Date()) {
      return new Response(JSON.stringify({ success: false, message: 'Account locked. Try again later.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403,
      });
    }

    if (!senderUser.pin_hash) {
      return new Response(JSON.stringify({ success: false, message: 'Please set your PIN in Settings first' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      });
    }

    const pinHash = await hashPin(pin);
    if (pinHash !== senderUser.pin_hash) {
      const attempts = (senderUser.failed_pin_attempts || 0) + 1;
      const updates: any = { failed_pin_attempts: attempts };
      if (attempts >= 5) {
        updates.pin_locked_until = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // Lock 30 min
      }
      await supabase.from('users').update(updates).eq('id', sender_user_id);
      return new Response(JSON.stringify({ success: false, message: `Wrong PIN. ${5 - attempts} attempts remaining.` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      });
    }

    // Reset failed attempts on success
    await supabase.from('users').update({ failed_pin_attempts: 0, pin_locked_until: null }).eq('id', sender_user_id);

    // Get wallets
    const { data: senderWallet } = await supabase.from('wallets').select('*').eq('id', sender_wallet_id).single();
    const { data: receiverWallet } = await supabase.from('wallets').select('*').eq('wallet_number', receiver_wallet_id).single();

    if (!senderWallet || !receiverWallet) {
      return new Response(JSON.stringify({ success: false, message: 'Wallet not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404,
      });
    }

    const fee = amount * 0.002;
    const totalDeduction = amount + fee;

    if (Number(senderWallet.balance) < totalDeduction) {
      return new Response(JSON.stringify({ success: false, message: 'Insufficient balance' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      });
    }

    const reference = crypto.randomUUID();

    // Deduct sender
    const { error: deductError } = await supabase
      .from('wallets')
      .update({ balance: Number(senderWallet.balance) - totalDeduction })
      .eq('id', senderWallet.id);

    if (deductError) {
      return new Response(JSON.stringify({ success: false, message: 'Transfer failed (debit)' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
      });
    }

    // Credit receiver
    const { error: creditError } = await supabase
      .from('wallets')
      .update({ balance: Number(receiverWallet.balance) + amount })
      .eq('id', receiverWallet.id);

    if (creditError) {
      // Rollback sender
      await supabase.from('wallets').update({ balance: Number(senderWallet.balance) }).eq('id', senderWallet.id);
      return new Response(JSON.stringify({ success: false, message: 'Transfer failed (credit)' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
      });
    }

    // Record transaction
    await supabase.from('transactions').insert({
      user_id: sender_user_id,
      wallet_id: senderWallet.id,
      sender_wallet_id: senderWallet.id,
      receiver_wallet_id: receiverWallet.id,
      sender_user_id: sender_user_id,
      receiver_user_id: receiverWallet.user_id,
      type: 'transfer',
      amount,
      fee,
      currency: senderWallet.currency,
      status: 'completed',
      reference,
    });

    // Notifications
    const { data: receiverUser } = await supabase.from('users').select('full_name').eq('id', receiverWallet.user_id).maybeSingle();
    const { data: senderUserData } = await supabase.from('users').select('full_name').eq('id', sender_user_id).maybeSingle();

    await supabase.from('notifications').insert([
      {
        user_id: sender_user_id,
        message: `You sent ${senderWallet.currency} ${amount.toLocaleString()} to ${receiverUser?.full_name || 'Unknown'}`,
        type: 'transfer',
      },
      {
        user_id: receiverWallet.user_id,
        message: `You received ${senderWallet.currency} ${amount.toLocaleString()} from ${senderUserData?.full_name || 'Unknown'}`,
        type: 'transfer',
      },
    ]);

    return new Response(JSON.stringify({ success: true, message: 'Transfer successful', reference }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Send money error:', error);
    return new Response(JSON.stringify({ success: false, message: 'Server error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    });
  }
});
