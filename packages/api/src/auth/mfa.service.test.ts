import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditService } from '../audit/audit.service';
import type { Env } from '../config/env';
import type { PrismaService } from '../prisma/prisma.service';
import { MfaService } from './mfa.service';
import { totpCode } from './totp';

interface UserRow {
  role: string;
  mfaEnabled: boolean;
  mfaSecret: string | null;
}

function makeService(initial: UserRow) {
  const row: UserRow = { ...initial };
  const prisma = {
    user: {
      findUnique: vi.fn(async () => ({ ...row })),
      update: vi.fn(async ({ data }: { data: Partial<UserRow> }) => {
        Object.assign(row, data);
        return { ...row };
      }),
    },
  } as unknown as PrismaService;
  const audit = { record: vi.fn(async () => undefined) } as unknown as AuditService;
  const env = { JWT_ACCESS_SECRET: 'a', JWT_REFRESH_SECRET: 'b', MFA_ISSUER: 'Yenetta' } as Env;
  return { service: new MfaService(prisma, audit, env), row, audit };
}

describe('MfaService.isRequired', () => {
  it('requires MFA only for enabled admins', () => {
    const { service } = makeService({ role: 'admin', mfaEnabled: true, mfaSecret: 'x' });
    expect(service.isRequired({ role: 'admin', mfaEnabled: true })).toBe(true);
    expect(service.isRequired({ role: 'admin', mfaEnabled: false })).toBe(false);
    expect(service.isRequired({ role: 'student', mfaEnabled: true })).toBe(false);
  });
});

describe('MfaService enrollment', () => {
  let ctx: ReturnType<typeof makeService>;
  beforeEach(() => {
    ctx = makeService({ role: 'admin', mfaEnabled: false, mfaSecret: null });
  });

  it('begins enrollment with a stored, encrypted secret and MFA still disabled', async () => {
    const { secret, otpauthUri } = await ctx.service.beginEnrollment('u1', '+251900000001');
    expect(otpauthUri).toContain('otpauth://totp/');
    expect(ctx.row.mfaEnabled).toBe(false);
    // Stored value is the ciphertext, never the plaintext secret.
    expect(ctx.row.mfaSecret).not.toBe(secret);
    expect(ctx.row.mfaSecret).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
  });

  it('confirms with a valid code and enables MFA', async () => {
    const { secret } = await ctx.service.beginEnrollment('u1', '+251900000001');
    await ctx.service.confirmEnrollment('u1', totpCode(secret), '1.2.3.4');
    expect(ctx.row.mfaEnabled).toBe(true);
    expect(ctx.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'mfa.enabled', actorUserId: 'u1' }),
    );
  });

  it('rejects confirmation with a wrong code', async () => {
    await ctx.service.beginEnrollment('u1', '+251900000001');
    await expect(ctx.service.confirmEnrollment('u1', '000000')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(ctx.row.mfaEnabled).toBe(false);
  });

  it('rejects confirmation when no enrollment is in progress', async () => {
    await expect(ctx.service.confirmEnrollment('u1', '123456')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('MfaService.verifyCode and disable', () => {
  it('verifies a login code only when enabled', async () => {
    const ctx = makeService({ role: 'admin', mfaEnabled: false, mfaSecret: null });
    const { secret } = await ctx.service.beginEnrollment('u1', '+251900000001');
    // Not enabled yet -> verifyCode is false even with a correct code.
    expect(await ctx.service.verifyCode('u1', totpCode(secret))).toBe(false);
    await ctx.service.confirmEnrollment('u1', totpCode(secret));
    expect(await ctx.service.verifyCode('u1', totpCode(secret))).toBe(true);
  });

  it('disables MFA only after re-verifying a current code', async () => {
    const ctx = makeService({ role: 'admin', mfaEnabled: false, mfaSecret: null });
    const { secret } = await ctx.service.beginEnrollment('u1', '+251900000001');
    await ctx.service.confirmEnrollment('u1', totpCode(secret));

    await expect(ctx.service.disable('u1', '000000')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(ctx.row.mfaEnabled).toBe(true);

    await ctx.service.disable('u1', totpCode(secret), '1.2.3.4');
    expect(ctx.row.mfaEnabled).toBe(false);
    expect(ctx.row.mfaSecret).toBeNull();
  });
});
