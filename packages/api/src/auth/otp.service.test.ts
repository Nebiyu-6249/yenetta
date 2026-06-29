import { HttpException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type Env } from '../config/env';
import { type PrismaService } from '../prisma/prisma.service';
import { type SmsProvider } from '../providers/sms/sms-provider.interface';
import { MAX_OTP_ATTEMPTS, OtpService } from './otp.service';

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    NODE_ENV: 'test',
    OTP_TTL_SECONDS: 300,
    OTP_RATE_LIMIT_PER_HOUR: 5,
    JWT_ACCESS_SECRET: 'test-secret',
    ...overrides,
  } as Env;
}

interface MockPrisma {
  authOtp: {
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
}

function makeService(env: Env = makeEnv()) {
  const prisma: MockPrisma = {
    authOtp: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({}),
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    },
  };
  const sms: SmsProvider = { name: 'mock', sendOtp: vi.fn().mockResolvedValue(undefined) };
  const service = new OtpService(prisma as unknown as PrismaService, sms, env);
  return { service, prisma, sms };
}

describe('OtpService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('generates a 6-digit numeric code', () => {
    const { service } = makeService();
    for (let i = 0; i < 50; i++) {
      expect(service.generateCode()).toMatch(/^\d{6}$/);
    }
  });

  it('hashes codes deterministically and bound to the phone', () => {
    const { service } = makeService();
    const a = service.hashCode('+251911000000', '123456');
    expect(a).toBe(service.hashCode('+251911000000', '123456'));
    expect(a).not.toBe(service.hashCode('+251911000001', '123456'));
    expect(a).not.toContain('123456');
  });

  it('issues an OTP, sends it, and returns the dev code outside production', async () => {
    const { service, prisma, sms } = makeService();
    const result = await service.requestOtp('+251911000000');

    expect(prisma.authOtp.create).toHaveBeenCalledOnce();
    expect(sms.sendOtp).toHaveBeenCalledOnce();
    expect(result.devCode).toMatch(/^\d{6}$/);
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('hides the dev code in production', async () => {
    const { service } = makeService(makeEnv({ NODE_ENV: 'production' }));
    const result = await service.requestOtp('+251911000000');
    expect(result.devCode).toBeUndefined();
  });

  it('enforces the hourly rate limit', async () => {
    const { service, prisma } = makeService(makeEnv({ OTP_RATE_LIMIT_PER_HOUR: 3 }));
    prisma.authOtp.count.mockResolvedValue(3);
    await expect(service.requestOtp('+251911000000')).rejects.toBeInstanceOf(HttpException);
    expect(prisma.authOtp.create).not.toHaveBeenCalled();
  });

  it('verifies a correct, unexpired code and consumes it', async () => {
    const { service, prisma } = makeService();
    const phone = '+251911000000';
    const code = '654321';
    prisma.authOtp.findFirst.mockResolvedValue({
      id: 'otp1',
      attempts: 0,
      codeHash: service.hashCode(phone, code),
    });

    await expect(service.verifyOtp(phone, code)).resolves.toBe(true);
    expect(prisma.authOtp.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ consumedAt: expect.any(Date) }) }),
    );
  });

  it('rejects a wrong code and increments attempts', async () => {
    const { service, prisma } = makeService();
    const phone = '+251911000000';
    prisma.authOtp.findFirst.mockResolvedValue({
      id: 'otp1',
      attempts: 0,
      codeHash: service.hashCode(phone, '111111'),
    });

    await expect(service.verifyOtp(phone, '999999')).resolves.toBe(false);
    expect(prisma.authOtp.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { attempts: { increment: 1 } } }),
    );
  });

  it('returns false when no valid OTP exists', async () => {
    const { service, prisma } = makeService();
    prisma.authOtp.findFirst.mockResolvedValue(null);
    await expect(service.verifyOtp('+251911000000', '123456')).resolves.toBe(false);
  });

  it('locks out after too many attempts', async () => {
    const { service, prisma } = makeService();
    const phone = '+251911000000';
    const code = '654321';
    prisma.authOtp.findFirst.mockResolvedValue({
      id: 'otp1',
      attempts: MAX_OTP_ATTEMPTS,
      codeHash: service.hashCode(phone, code),
    });
    await expect(service.verifyOtp(phone, code)).resolves.toBe(false);
    expect(prisma.authOtp.update).not.toHaveBeenCalled();
  });
});
