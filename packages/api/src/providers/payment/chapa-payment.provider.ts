import { createHmac, timingSafeEqual } from 'node:crypto';
import { Logger } from '@nestjs/common';
import {
  type CheckoutInput,
  type CheckoutResult,
  type PaymentProvider,
  type ProviderPaymentStatus,
  type WebhookResult,
} from './payment-provider.interface';

export interface ChapaConfig {
  mode: 'sandbox' | 'live';
  secretKey?: string;
  webhookSecret?: string;
  siteUrl: string;
}

interface ChapaInitResponse {
  status: string;
  data?: { checkout_url: string };
}

interface ChapaWebhookPayload {
  tx_ref?: string;
  reference?: string;
  status?: string;
  amount?: string | number;
  currency?: string;
}

/**
 * Chapa payment provider (BUILD_BRIEF §7) — covers Telebirr, CBE Birr, and
 * cards. Sandbox by default; flip to live by swapping keys (no code change).
 * Without a secret key (local dev) it returns a mock checkout URL so the flow
 * is exercisable end-to-end via the (signed) webhook.
 */
export class ChapaPaymentProvider implements PaymentProvider {
  readonly name = 'chapa';
  private readonly logger = new Logger(ChapaPaymentProvider.name);
  private readonly baseUrl = 'https://api.chapa.co/v1';

  constructor(private readonly config: ChapaConfig) {}

  async initializeCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    if (!this.config.secretKey) {
      // Dev/mock: no real call; complete the purchase via the webhook.
      this.logger.warn('CHAPA_SECRET_KEY missing — returning a mock checkout URL (dev only)');
      return {
        checkoutUrl: `${this.config.siteUrl}/checkout/mock?tx=${input.reference}`,
        providerTxId: input.reference,
      };
    }

    const res = await fetch(`${this.baseUrl}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: input.amount,
        currency: input.currency,
        tx_ref: input.reference,
        callback_url: `${this.config.siteUrl}/api/payments/webhook`,
        return_url: input.returnUrl ?? `${this.config.siteUrl}/dashboard`,
      }),
    });
    if (!res.ok) {
      throw new Error(`Chapa init failed: ${res.status} ${await res.text()}`);
    }
    const json = (await res.json()) as ChapaInitResponse;
    if (!json.data?.checkout_url) {
      throw new Error('Chapa init returned no checkout_url');
    }
    return { checkoutUrl: json.data.checkout_url, providerTxId: input.reference };
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!this.config.webhookSecret || !signature) return false;
    const expected = createHmac('sha256', this.config.webhookSecret).update(rawBody).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  parseWebhook(payload: unknown): WebhookResult {
    const body = (payload ?? {}) as ChapaWebhookPayload;
    const reference = body.tx_ref ?? body.reference ?? '';
    const status: ProviderPaymentStatus =
      body.status === 'success' ? 'success' : body.status === 'failed' ? 'failed' : 'pending';
    return {
      providerTxId: reference,
      reference,
      status,
      amount: Number(body.amount ?? 0),
      currency: body.currency ?? 'ETB',
    };
  }
}
