import { type Env } from '../../config/env';
import { ChapaPaymentProvider } from './chapa-payment.provider';
import { type PaymentProvider } from './payment-provider.interface';

export function createPaymentProvider(env: Env): PaymentProvider {
  // Only Chapa is supported for now; the abstraction keeps it swappable.
  return new ChapaPaymentProvider({
    mode: env.CHAPA_MODE,
    secretKey: env.CHAPA_SECRET_KEY,
    webhookSecret: env.CHAPA_WEBHOOK_SECRET,
    siteUrl: env.SITE_URL,
  });
}
