import { supabase } from '@/integrations/supabase/client';

type PaymentLogMetadata = {
  provider: 'intasend' | 'paystack' | 'daraja' | 'wallet';
  phone_number?: string;
  narrative?: string;
  network?: string;
  balance_change_mode?: 'credit_on_success' | 'debit_on_success' | 'move_on_success' | 'no_balance_change';
  [key: string]: unknown;
};

class PaymentService {
  private async resolveUserId() {
    const { data: userId, error } = await supabase.rpc('get_user_id_from_auth');

    if (error || !userId) {
      throw new Error('User profile not found');
    }

    return userId;
  }

  private async getOwnedWallet(walletId: string, userId: string, currency = 'KES') {
    const { data: wallet, error } = await supabase
      .from('wallets')
      .select('id, currency, balance, wallet_number')
      .eq('id', walletId)
      .eq('user_id', userId)
      .single();

    if (error || !wallet) {
      throw new Error('Wallet not found or access denied');
    }

    if (wallet.currency !== currency) {
      throw new Error('Currency mismatch');
    }

    return wallet;
  }

  private async createPaymentLog(input: {
    userId: string;
    walletId: string;
    paymentType: string;
    amount: number;
    currency: string;
    providerReference: string;
    providerResponse: unknown;
    metadata?: PaymentLogMetadata;
  }) {
    const { error } = await supabase
      .from('payment_logs')
      .insert({
        user_id: input.userId,
        wallet_id: input.walletId,
        payment_type: input.paymentType,
        amount: input.amount,
        currency: input.currency,
        provider_reference: input.providerReference,
        status: 'pending',
        provider_response: input.providerResponse,
        metadata: input.metadata ?? {},
      } as never);

    if (error) {
      throw new Error(error.message || 'Failed to track payment');
    }
  }
  
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
    const currency = request.currency || 'KES';
    const userId = await this.resolveUserId();
    const wallet = await this.getOwnedWallet(request.wallet_id, userId, currency);
    const providerReference = crypto.randomUUID();

    const { data: stkResult, error: stkError } = await supabase.functions.invoke('payment-microservice-proxy', {
      body: {
        action: 'mpesa_stk_push',
        api_ref: providerReference,
        external_user_id: userId,
        external_wallet_id: wallet.id,
        phone_number: request.phone_number,
        amount: request.amount,
        currency,
        narrative: request.narrative || 'AbanRemit wallet funding',
      }
    });

    if (stkError) {
      throw new Error(stkError.message || 'Payment service unavailable');
    }

    if (!stkResult?.success) {
      throw new Error(stkResult?.error || 'STK push failed');
    }

    const resolvedReference =
      stkResult.api_ref ||
      stkResult.reference ||
      stkResult.data?.api_ref ||
      stkResult.data?.reference ||
      providerReference;

    await this.createPaymentLog({
      userId,
      walletId: wallet.id,
      paymentType: 'mpesa_stk',
      amount: request.amount,
      currency,
      providerReference: resolvedReference,
      providerResponse: stkResult,
      metadata: {
        provider: 'intasend',
        phone_number: request.phone_number,
        narrative: request.narrative || 'AbanRemit wallet funding',
        network: 'intasend',
        balance_change_mode: 'credit_on_success',
        wallet_number: wallet.wallet_number,
      },
    });

    return {
      ...stkResult,
      provider_reference: resolvedReference,
    };
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
