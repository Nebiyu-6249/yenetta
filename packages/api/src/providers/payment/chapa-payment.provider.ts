import { Logger, NotImplementedException } from '@nestjs/common';
import {
  type CheckoutInput,
  type CheckoutResult,
  type PaymentProvider,
  type WebhookResult,
} from './payment-provider.interface';

export interface ChapaConfig {
  mode: 'sandbox' | 'live';
  secretKey?: string;
  webhookSecret?: string;
}

/**
 * Chapa implementation skeleton (BUILD_BRIEF §7). Checkout init + webhook
 * verification + idempotent handling land end-to-end in M6; M1 wires the shape.
 */
export class ChapaPaymentProvider implements PaymentProvider {
  readonly name = 'chapa';
  private readonly logger = new Logger(ChapaPaymentProvider.name);

  constructor(private readonly config: ChapaConfig) {}

  async initializeCheckout(_input: CheckoutInput): Promise<CheckoutResult> {
    this.logger.warn(`Chapa checkout (${this.config.mode}) not implemented until M6`);
    throw new NotImplementedException('Chapa checkout lands in M6');
  }

  verifyWebhookSignature(_rawBody: string, _signature: string): boolean {
    // Real HMAC verification against CHAPA_WEBHOOK_SECRET arrives in M6.
    return false;
  }

  parseWebhook(_payload: unknown): WebhookResult {
    throw new NotImplementedException('Chapa webhook parsing lands in M6');
  }
}
