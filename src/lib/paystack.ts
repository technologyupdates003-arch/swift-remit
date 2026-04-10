// Paystack Service - Routes all API calls through edge function (secret key stays server-side)

import { supabase } from '@/integrations/supabase/client';

class PaystackService {
  private async proxy(action: string, payload: Record<string, unknown> = {}) {
    const { data, error } = await supabase.functions.invoke('paystack-proxy', {
      body: { action, ...payload },
    });
    if (error) throw new Error(error.message || 'Paystack request failed');
    return data;
  }

  async initializePayment(request: {
    email: string;
    amount: number;
    currency: string;
    reference: string;
    callback_url?: string;
    metadata?: unknown;
  }) {
    return this.proxy('initialize', request);
  }

  async verifyPayment(reference: string) {
    return this.proxy('verify', { reference });
  }

  async getBanks(currency = 'NGN') {
    return this.proxy('list_banks', { currency });
  }

  async resolveAccountNumber(account_number: string, bank_code: string) {
    return this.proxy('resolve_account', { account_number, bank_code });
  }

  async createTransferRecipient(request: {
    type?: string;
    name: string;
    account_number: string;
    bank_code: string;
    currency: string;
  }) {
    return this.proxy('create_recipient', request);
  }

  async initiateTransfer(request: {
    amount: number;
    recipient: string;
    reason?: string;
    reference?: string;
  }) {
    return this.proxy('initiate_transfer', request);
  }

  convertToSubunit(amount: number, currency: string): number {
    const multipliers: Record<string, number> = {
      NGN: 100, USD: 100, EUR: 100, GBP: 100, KES: 100, ZAR: 100, JPY: 1,
    };
    return Math.round(amount * (multipliers[currency] || 100));
  }

  convertFromSubunit(amount: number, currency: string): number {
    const multipliers: Record<string, number> = {
      NGN: 100, USD: 100, EUR: 100, GBP: 100, KES: 100, ZAR: 100, JPY: 1,
    };
    return amount / (multipliers[currency] || 100);
  }

  generateReference(prefix = 'PSK'): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  getCurrencySymbol(currency: string): string {
    const symbols: Record<string, string> = {
      NGN: '₦', USD: '$', EUR: '€', GBP: '£', KES: 'KSh', ZAR: 'R', JPY: '¥',
    };
    return symbols[currency] || currency;
  }
}

export const paystackService = new PaystackService();
export default PaystackService;