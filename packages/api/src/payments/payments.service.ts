import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  PAYMENT_PROVIDER,
  type PaymentProvider,
} from '../providers/payment/payment-provider.interface';

export const PREMIUM_PRICE = 299;
export const PREMIUM_CURRENCY = 'ETB';
export const PREMIUM_PERIOD_DAYS = 30;

export interface CheckoutResult {
  checkoutUrl: string;
  txRef: string;
}

export interface WebhookOutcome {
  ok: boolean;
  status: 'success' | 'failed' | 'pending' | 'idempotent';
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    private readonly audit: AuditService,
  ) {}

  /** Starts a Premium purchase: records a pending payment and returns a URL. */
  async createCheckout(userId: string): Promise<CheckoutResult> {
    const reference = `yen_${randomUUID()}`;
    await this.prisma.payment.create({
      data: {
        userId,
        provider: this.provider.name,
        providerTxId: reference,
        amount: PREMIUM_PRICE,
        currency: PREMIUM_CURRENCY,
        status: 'pending',
      },
    });
    const { checkoutUrl, providerTxId } = await this.provider.initializeCheckout({
      userId,
      amount: PREMIUM_PRICE,
      currency: PREMIUM_CURRENCY,
      reference,
    });
    return { checkoutUrl, txRef: providerTxId };
  }

  /**
   * Verifies + processes a provider webhook. Idempotent: a payment already
   * marked success is a no-op, so duplicate deliveries can't double-grant.
   */
  async handleWebhook(rawBody: string, signature: string): Promise<WebhookOutcome> {
    if (!this.provider.verifyWebhookSignature(rawBody, signature)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
    const parsed = this.provider.parseWebhook(JSON.parse(rawBody));
    const payment = await this.prisma.payment.findUnique({
      where: { providerTxId: parsed.providerTxId },
    });
    if (!payment) {
      throw new NotFoundException('Unknown payment reference');
    }
    if (payment.status === 'success') {
      return { ok: true, status: 'idempotent' };
    }

    if (parsed.status === 'success') {
      // Server-side amount/currency verification (SECURITY.md section 5): never
      // grant Premium unless the paid amount/currency match what we recorded at
      // checkout. Guards against tampered/underpaid webhooks.
      const expectedAmount = Number(payment.amount);
      const amountMatches = Number.isFinite(parsed.amount) && parsed.amount === expectedAmount;
      const currencyMatches = parsed.currency === payment.currency;
      if (!amountMatches || !currencyMatches) {
        this.logger.warn(
          `Payment ${payment.id} amount/currency mismatch: expected ${expectedAmount} ${payment.currency}, got ${parsed.amount} ${parsed.currency}`,
        );
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'failed', rawWebhook: parsed as unknown as object },
        });
        throw new BadRequestException('Payment amount or currency mismatch');
      }

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'success', rawWebhook: parsed as unknown as object },
      });
      await this.activatePremium(payment.userId);
      await this.audit.record({
        action: 'payment.succeeded',
        actorUserId: payment.userId,
        targetType: 'payment',
        targetId: payment.id,
        metadata: { amount: expectedAmount, currency: payment.currency },
      });
      this.logger.log(`Premium activated for ${payment.userId} (${parsed.providerTxId})`);
      return { ok: true, status: 'success' };
    }

    if (parsed.status === 'failed') {
      await this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'failed' } });
      return { ok: true, status: 'failed' };
    }
    return { ok: true, status: 'pending' };
  }

  /** Creates or extends an active Premium subscription by one period. */
  async activatePremium(userId: string): Promise<void> {
    const now = new Date();
    const existing = await this.prisma.subscription.findFirst({
      where: { userId, tier: 'premium', status: 'active' },
      orderBy: { expiresAt: 'desc' },
    });
    const base = existing?.expiresAt && existing.expiresAt > now ? existing.expiresAt : now;
    const expiresAt = new Date(base.getTime() + PREMIUM_PERIOD_DAYS * 24 * 3600 * 1000);

    if (existing) {
      await this.prisma.subscription.update({ where: { id: existing.id }, data: { expiresAt } });
    } else {
      await this.prisma.subscription.create({
        data: { userId, tier: 'premium', status: 'active', expiresAt, source: 'chapa' },
      });
    }
  }

  /** Voucher / scratch-code redemption (stub: one dev code grants Premium). */
  async redeemVoucher(userId: string, code: string): Promise<{ ok: boolean }> {
    if (code.trim().toUpperCase() !== 'YENETTA-PREMIUM') {
      throw new BadRequestException('Invalid or expired voucher code');
    }
    await this.activatePremium(userId);
    await this.audit.record({ action: 'voucher.redeemed', actorUserId: userId });
    return { ok: true };
  }

  /** Marks lapsed subscriptions as expired (read-time resolution already
   * downgrades; this keeps statuses tidy for analytics/reminders). */
  async expireLapsed(): Promise<number> {
    const result = await this.prisma.subscription.updateMany({
      where: { status: 'active', expiresAt: { lt: new Date() } },
      data: { status: 'expired' },
    });
    return result.count;
  }
}
