/** Pluggable payment contract (BUILD_BRIEF §7). Chapa is the first impl. */

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export interface CheckoutInput {
  userId: string;
  amount: number;
  currency: string;
  /** Caller-generated idempotency reference. */
  reference: string;
  returnUrl?: string;
}

export interface CheckoutResult {
  checkoutUrl: string;
  providerTxId: string;
}

export type ProviderPaymentStatus = 'pending' | 'success' | 'failed';

export interface WebhookResult {
  providerTxId: string;
  status: ProviderPaymentStatus;
  amount: number;
  currency: string;
  reference: string;
}

export interface PaymentProvider {
  readonly name: string;
  initializeCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  /** Verifies the webhook signature against the shared secret. */
  verifyWebhookSignature(rawBody: string, signature: string): boolean;
  parseWebhook(payload: unknown): WebhookResult;
}
