import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type PaymentProvider } from '../providers/payment/payment-provider.interface';
import { type PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from './payments.service';

function makeProvider(overrides: Partial<PaymentProvider> = {}): PaymentProvider {
  return {
    name: 'chapa',
    initializeCheckout: vi.fn(async (input) => ({
      checkoutUrl: `https://pay/${input.reference}`,
      providerTxId: input.reference,
    })),
    verifyWebhookSignature: vi.fn(() => true),
    parseWebhook: vi.fn(() => ({
      providerTxId: 'yen_1',
      reference: 'yen_1',
      status: 'success' as const,
      amount: 299,
      currency: 'ETB',
    })),
    ...overrides,
  };
}

function makeAudit() {
  return { record: vi.fn().mockResolvedValue(undefined) };
}

function makePrisma(payment: unknown, existingSub: unknown = null) {
  // Recorded payments default to the server-side price so amount/currency
  // verification passes unless a test overrides them.
  const withDefaults =
    payment && typeof payment === 'object'
      ? { amount: 299, currency: 'ETB', ...(payment as object) }
      : payment;
  return {
    payment: {
      create: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue(withDefaults),
      update: vi.fn().mockResolvedValue({}),
    },
    subscription: {
      findFirst: vi.fn().mockResolvedValue(existingSub),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };
}

describe('PaymentsService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a pending payment and returns a checkout URL', async () => {
    const prisma = makePrisma(null);
    const service = new PaymentsService(
      prisma as unknown as PrismaService,
      makeProvider(),
      makeAudit() as never,
    );
    const result = await service.createCheckout('user-1');

    expect(prisma.payment.create).toHaveBeenCalledOnce();
    expect(result.checkoutUrl).toContain('https://pay/');
    expect(result.txRef).toBe(prisma.payment.create.mock.calls[0]![0].data.providerTxId);
  });

  it('activates Premium on a verified successful webhook', async () => {
    const prisma = makePrisma({ id: 'p1', userId: 'user-1', status: 'pending' });
    const service = new PaymentsService(
      prisma as unknown as PrismaService,
      makeProvider(),
      makeAudit() as never,
    );
    const outcome = await service.handleWebhook('{}', 'sig');

    expect(outcome.status).toBe('success');
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'success' }) }),
    );
    expect(prisma.subscription.create).toHaveBeenCalledOnce();
  });

  it('is idempotent — a second delivery does not re-grant', async () => {
    const prisma = makePrisma({ id: 'p1', userId: 'user-1', status: 'success' });
    const service = new PaymentsService(
      prisma as unknown as PrismaService,
      makeProvider(),
      makeAudit() as never,
    );
    const outcome = await service.handleWebhook('{}', 'sig');

    expect(outcome.status).toBe('idempotent');
    expect(prisma.subscription.create).not.toHaveBeenCalled();
  });

  it('rejects a successful webhook whose amount does not match the recorded payment', async () => {
    // Recorded price is 1 but the webhook claims a 299 success -> reject, no grant.
    const prisma = makePrisma({ id: 'p1', userId: 'user-1', status: 'pending', amount: 1 });
    const service = new PaymentsService(
      prisma as unknown as PrismaService,
      makeProvider(),
      makeAudit() as never,
    );
    await expect(service.handleWebhook('{}', 'sig')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.subscription.create).not.toHaveBeenCalled();
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'failed' }) }),
    );
  });

  it('rejects a webhook with a mismatched currency', async () => {
    const prisma = makePrisma({ id: 'p1', userId: 'user-1', status: 'pending', currency: 'USD' });
    const service = new PaymentsService(
      prisma as unknown as PrismaService,
      makeProvider(),
      makeAudit() as never,
    );
    await expect(service.handleWebhook('{}', 'sig')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.subscription.create).not.toHaveBeenCalled();
  });

  it('rejects a webhook with an invalid signature', async () => {
    const prisma = makePrisma({ id: 'p1', userId: 'user-1', status: 'pending' });
    const provider = makeProvider({ verifyWebhookSignature: vi.fn(() => false) });
    const service = new PaymentsService(
      prisma as unknown as PrismaService,
      provider,
      makeAudit() as never,
    );
    await expect(service.handleWebhook('{}', 'bad')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('extends an existing active subscription instead of creating a new one', async () => {
    const future = new Date(Date.now() + 10 * 86_400_000);
    const prisma = makePrisma(
      { id: 'p1', userId: 'user-1', status: 'pending' },
      { id: 's1', expiresAt: future },
    );
    const service = new PaymentsService(
      prisma as unknown as PrismaService,
      makeProvider(),
      makeAudit() as never,
    );
    await service.handleWebhook('{}', 'sig');

    expect(prisma.subscription.update).toHaveBeenCalledOnce();
    expect(prisma.subscription.create).not.toHaveBeenCalled();
  });

  it('redeems a valid voucher and rejects an invalid one', async () => {
    const prisma = makePrisma(null);
    const service = new PaymentsService(
      prisma as unknown as PrismaService,
      makeProvider(),
      makeAudit() as never,
    );
    await expect(service.redeemVoucher('user-1', 'yenetta-premium')).resolves.toEqual({ ok: true });
    await expect(service.redeemVoucher('user-1', 'nope')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
