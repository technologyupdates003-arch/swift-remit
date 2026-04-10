import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Provider = 'intasend' | 'paystack' | 'daraja' | 'unknown';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const normalizeStatus = (value: unknown) => String(value ?? '').toLowerCase();

const detectProvider = (provider: string | null, payload: Record<string, any>): Provider => {
  if (provider === 'intasend' || provider === 'paystack' || provider === 'daraja') {
    return provider;
  }

  if (payload.api_ref || payload.challenge || payload.invoice_id || payload.invoice?.invoice_id) {
    return 'intasend';
  }

  if (payload.event || payload.data?.reference) {
    return 'paystack';
  }

  if (payload.Result || payload.Body?.stkCallback) {
    return 'daraja';
  }

  return 'unknown';
};

const extractDarajaAmount = (payload: Record<string, any>) => {
  const resultParameters = payload.Result?.ResultParameters?.ResultParameter;

  if (Array.isArray(resultParameters)) {
    const amountItem = resultParameters.find((item: any) => item.Key === 'Amount');
    return amountItem?.Value;
  }

  return null;
};

const extractWebhookInfo = (provider: Provider, payload: Record<string, any>) => {
  switch (provider) {
    case 'intasend':
      return {
        reference:
          payload.api_ref ||
          payload.invoice_id ||
          payload.invoice?.invoice_id ||
          payload.data?.api_ref ||
          payload.data?.reference ||
          null,
        status: normalizeStatus(payload.state || payload.status),
        phoneNumber: payload.account || payload.phone_number || payload.msisdn || null,
        amount: payload.value || payload.net_amount || payload.amount || null,
      };

    case 'paystack':
      return {
        reference: payload.data?.reference || null,
        status:
          payload.event === 'charge.success' || payload.event === 'transfer.success'
            ? 'completed'
            : payload.event === 'transfer.failed' || payload.event === 'charge.failed'
              ? 'failed'
              : normalizeStatus(payload.data?.status || payload.event),
        phoneNumber: payload.data?.customer?.phone || payload.data?.metadata?.phone_number || null,
        amount: payload.data?.amount ? Number(payload.data.amount) / 100 : null,
      };

    case 'daraja':
      return {
        reference:
          payload.Result?.ConversationID ||
          payload.Result?.OriginatorConversationID ||
          payload.Body?.stkCallback?.CheckoutRequestID ||
          null,
        status:
          payload.Result?.ResultCode === 0 || payload.Body?.stkCallback?.ResultCode === 0
            ? 'completed'
            : payload.Result?.ResultCode != null || payload.Body?.stkCallback?.ResultCode != null
              ? 'failed'
              : 'pending',
        phoneNumber: payload.Result?.ReceiverPartyPublicName || payload.PhoneNumber || null,
        amount: extractDarajaAmount(payload),
      };

    default:
      return {
        reference: null,
        status: 'pending',
        phoneNumber: null,
        amount: null,
      };
  }
};

const sendSms = async (supabaseClient: any, payload: {
  phoneNumber?: string | null;
  message: string;
  userId?: string | null;
}) => {
  if (!payload.phoneNumber) return;

  try {
    const smsUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-sms-notification`;
    await fetch(smsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        phone_number: payload.phoneNumber,
        message: payload.message,
        sms_type: 'transaction',
        user_id: payload.userId,
        charge_fee: false,
      }),
    });
  } catch (err) {
    console.error('SMS send error:', err);
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const webhookPayload = await req.json();
    const url = new URL(req.url);
    const provider = detectProvider(url.searchParams.get('provider'), webhookPayload);

    console.log('=== UNIVERSAL WEBHOOK HANDLER ===');
    console.log('Provider:', provider);
    console.log('Payload:', JSON.stringify(webhookPayload));

    if (webhookPayload.challenge) {
      return json({ challenge: 'aban_remit_webhook_2024_secure' });
    }

    const webhookInfo = extractWebhookInfo(provider, webhookPayload);

    if (!webhookInfo.reference) {
      console.log('No payment reference found, skipping');
      return new Response('OK - No reference', { status: 200, headers: corsHeaders });
    }

    const { data: processResult, error: processError } = await supabase.rpc('handle_payment_webhook', {
      p_api_ref: webhookInfo.reference,
      p_state: webhookInfo.status || 'pending',
      p_webhook_data: webhookPayload,
    });

    if (processError) {
      console.error('Webhook processing error:', processError);
      return json({ error: processError.message }, 500);
    }

    const { data: paymentLog } = await supabase
      .from('payment_logs')
      .select('payment_type, amount, currency, metadata, wallet_id')
      .eq('provider_reference', webhookInfo.reference)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const microserviceUrl = Deno.env.get('PAYMENT_MICROSERVICE_URL');
    const microserviceKey = Deno.env.get('PAYMENT_MICROSERVICE_KEY');
    const normalizedStatus = normalizeStatus(webhookInfo.status);
    const isCompleted = ['completed', 'success', 'successful', 'complete'].includes(normalizedStatus);
    const isFailed = ['failed', 'cancelled', 'canceled', 'timeout', 'expired'].includes(normalizedStatus);

    if (microserviceUrl && microserviceKey && paymentLog) {
      const currency = paymentLog.currency || 'KES';
      const currencySymbol = currency === 'KES' ? 'KSh' : currency;
      const phoneNumber =
        webhookInfo.phoneNumber ||
        paymentLog.metadata?.phone_number ||
        paymentLog.metadata?.receiver_phone_number ||
        null;

      if (isCompleted && processResult?.success) {
        const amount = processResult.amount_added ?? paymentLog.amount ?? webhookInfo.amount ?? 0;
        const messageByType: Record<string, string> = {
          mpesa_stk: `Payment successful! ${currencySymbol}${amount} added to your AbanRemit wallet. New balance: ${currencySymbol}${processResult.new_balance}. Ref: ${webhookInfo.reference}`,
          paystack_card: `Card funding successful! ${currencySymbol}${amount} added to your AbanRemit wallet. Ref: ${webhookInfo.reference}`,
          paystack_bank: `Bank withdrawal successful! ${currencySymbol}${paymentLog.amount} has been processed. Ref: ${webhookInfo.reference}`,
          daraja_b2c: `M-Pesa withdrawal successful! ${currencySymbol}${paymentLog.amount} has been sent. Ref: ${webhookInfo.reference}`,
          wallet_transfer: `Wallet transfer successful! ${currencySymbol}${paymentLog.amount} has been processed. Ref: ${webhookInfo.reference}`,
        };

        await sendSms({
          microserviceUrl,
          microserviceKey,
          phoneNumber,
          message:
            messageByType[paymentLog.payment_type] ||
            `Transaction successful! Ref: ${webhookInfo.reference}`,
        });
      }

      if (isFailed) {
        await sendSms({
          microserviceUrl,
          microserviceKey,
          phoneNumber,
          message: `Transaction failed. ${currencySymbol}${paymentLog.amount} could not be completed. Ref: ${webhookInfo.reference}`,
        });
      }
    }

    return json({
      success: true,
      provider,
      reference: webhookInfo.reference,
      status: webhookInfo.status,
      result: processResult,
    });
  } catch (error) {
    console.error('Universal webhook error:', error);
    return json({ error: error.message || 'Unexpected webhook error' }, 500);
  }
});