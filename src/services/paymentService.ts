import { supabase } from '@/integrations/supabase/client';

class PaymentService {
  
  /**
   * Initiate M-Pesa STK Push via external microservice, 
   * then track in main backend for wallet sync via webhook.
   */
  async mpesaSTKPush(request: {
    phone_number: string;
    amount: number;
    currency?: string;
    narrative?: string;
    wallet_id: string;
  }) {
    // 1. Resolve internal user ID
    const { data: userId, error: userError } = await supabase.rpc('get_user_id_from_auth');
    if (userError || !userId) throw new Error('User profile not found');

    // 2. Verify wallet ownership
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('id, currency, balance')
      .eq('id', request.wallet_id)
      .eq('user_id', userId)
      .single();

    if (walletError || !wallet) throw new Error('Wallet not found or access denied');
    if (wallet.currency !== (request.currency || 'KES')) throw new Error('Currency mismatch');

    // 3. Call external payment microservice via our own edge function (keeps secrets server-side)
    const { data: stkResult, error: stkError } = await supabase.functions.invoke('payment-microservice-proxy', {
      body: {
        action: 'mpesa_stk_push',
        external_user_id: userId,
        external_wallet_id: wallet.id,
        phone_number: request.phone_number,
        amount: request.amount,
        currency: request.currency || 'KES',
        narrative: request.narrative || 'AbanRemit wallet funding',
      }
    });

    if (stkError) throw new Error(stkError.message || 'Payment service unavailable');
    if (!stkResult?.success) throw new Error(stkResult?.error || 'STK push failed');

    // 4. Create local payment log for tracking
    await supabase
      .from('payment_logs')
      .insert({
        user_id: userId,
        wallet_id: wallet.id,
        payment_type: 'mpesa_stk',
        amount: request.amount,
        currency: request.currency || 'KES',
        provider_reference: stkResult.api_ref || stkResult.reference || stkResult.data?.invoice?.invoice_id,
        status: 'pending',
        provider_response: stkResult,
      });

    return stkResult;
  }

  /**
   * Get wallet balance (reads from main backend)
   */
  async getWalletBalance(walletId: string) {
    const { data, error } = await supabase
      .from('wallets')
      .select('id, currency, balance, wallet_number')
      .eq('id', walletId)
      .single();

    if (error) throw error;
    return data;
  }
}

export const paymentService = new PaymentService();
