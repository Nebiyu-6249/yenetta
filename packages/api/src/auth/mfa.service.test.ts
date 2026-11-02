import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditService } from '../audit/audit.service';
import type { Env } from '../config/env';
import type { PrismaService } from '../prisma/prisma.service';
import { MAX_MFA_CHALLENGE_ATTEMPTS, MfaService } from './mfa.service';
import { totpCode, TOTP_STEP_SECONDS } from './totp';

interface UserRow {
  role: string;
  mfaEnabled: boolean;
  mfaSecret: string | null;
  mfaChallengeJti: string | null;
  mfaChallengeAttempts: number;
  mfaLastUsedStep: number | null;
}

type Where = Record<string, unknown>;

// Minimal Prisma `where` semantics for the single mocked row: equality, `lt`,
// `gte`, and `OR` (the `id` filter always matches the one row).
function matches(row: UserRow, where: Where): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (key === 'id') return true;
    if (key === 'OR') return (cond as Where[]).some((w) => matches(row, w));
    const actual = row[key as keyof UserRow];
    if (cond !== null && typeof cond === 'object') {
      const op = cond as { lt?: number; gte?: number };
      if (op.lt !== undefined && !(typeof actual === 'number' && actual < op.lt)) return false;
      if (op.gte !== undefined && !(typeof actual === 'number' && actual >= op.gte)) return false;
      return true;
    }
    return actual === cond;
  });
}

function apply(row: UserRow, data: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(data)) {
    const k = key as keyof UserRow;
    if (value !== null && typeof value === 'object' && 'increment' in value) {
      (row[k] as number) += (value as { increment: number }).increment;
    } else {
      (row as unknown as Record<string, unknown>)[k] = value;
    }
  }
}

function makeService(initial: Partial<UserRow> = {}) {
  const row: UserRow = {
    role: 'admin',
    mfaEnabled: false,
    mfaSecret: null,
    mfaChallengeJti: null,
    mfaChallengeAttempts: 0,
    mfaLastUsedStep: null,
    ...initial,
  };
  const prisma = {
    user: {
      findUnique: vi.fn(async () => ({ ...row })),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        apply(row, data);
        return { ...row };
      }),
      updateMany: vi.fn(
        async ({ where, data }: { where: Where; data: Record<string, unknown> }) => {
          if (!matches(row, where)) return { count: 0 };
          apply(row, data);
          return { count: 1 };
        },
      ),
    },
  } as unknown as PrismaService;
  const audit = { record: vi.fn(async () => undefined) } as unknown as AuditService;
  const env = { JWT_ACCESS_SECRET: 'a', JWT_REFRESH_SECRET: 'b', MFA_ISSUER: 'Yenetta' } as Env;
  return { service: new MfaService(prisma, audit, env), row, audit };
}

// Time is frozen mid-step so codes for the previous/current/next step are all
// inside the +/-1 verification window and never straddle a step boundary.
const NOW = Date.UTC(2026, 10, 2, 12, 0, 15);
const STEP_MS = TOTP_STEP_SECONDS * 1000;
const codeAt = (secret: string, stepOffset = 0) => totpCode(secret, NOW + stepOffset * STEP_MS);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

/** Enrolls + confirms with the previous step's code, leaving steps 0 and +1 unused. */
async function enabledService() {
  const ctx = makeService();
  const { secret } = await ctx.service.beginEnrollment('u1', '+251900000001');
  await ctx.service.confirmEnrollment('u1', codeAt(secret, -1));
  return { ...ctx, secret };
}

describe('MfaService.isRequired', () => {
  it('requires MFA only for enabled admins', () => {
    const { service } = makeService({ mfaEnabled: true, mfaSecret: 'x' });
    expect(service.isRequired({ role: 'admin', mfaEnabled: true })).toBe(true);
    expect(service.isRequired({ role: 'admin', mfaEnabled: false })).toBe(false);
    expect(service.isRequired({ role: 'student', mfaEnabled: true })).toBe(false);
  });
});

describe('MfaService enrollment', () => {
  let ctx: ReturnType<typeof makeService>;
  beforeEach(() => {
    ctx = makeService();
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
    await ctx.service.confirmEnrollment('u1', codeAt(secret), '1.2.3.4');
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
    const ctx = makeService();
    const { secret } = await ctx.service.beginEnrollment('u1', '+251900000001');
    // Not enabled yet -> verifyCode is false even with a correct code.
    expect(await ctx.service.verifyCode('u1', codeAt(secret, -1))).toBe(false);
    await ctx.service.confirmEnrollment('u1', codeAt(secret, -1));
    expect(await ctx.service.verifyCode('u1', codeAt(secret))).toBe(true);
  });

  it('accepts each code at most once (replay)', async () => {
    const { service, secret } = await enabledService();
    expect(await service.verifyCode('u1', codeAt(secret))).toBe(true);
    expect(await service.verifyCode('u1', codeAt(secret))).toBe(false);
  });

  it('rejects an older step once a newer one was accepted', async () => {
    const { service, secret } = await enabledService();
    expect(await service.verifyCode('u1', codeAt(secret, 1))).toBe(true);
    expect(await service.verifyCode('u1', codeAt(secret, 0))).toBe(false);
  });

  it('disables MFA only after re-verifying a current code', async () => {
    const { service, row, secret } = await enabledService();

    await expect(service.disable('u1', '000000')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(row.mfaEnabled).toBe(true);

    await service.disable('u1', codeAt(secret), '1.2.3.4');
    expect(row.mfaEnabled).toBe(false);
    expect(row.mfaSecret).toBeNull();
    expect(row.mfaLastUsedStep).toBeNull();
  });
});

describe('MfaService login challenge', () => {
  it('completes once and consumes the challenge', async () => {
    const { service, row, secret } = await enabledService();
    await service.startChallenge('u1', 'jti-1');

    await service.verifyChallenge('u1', 'jti-1', codeAt(secret));
    expect(row.mfaChallengeJti).toBeNull();

    // Same challenge again, even with a fresh valid code: rejected.
    await expect(service.verifyChallenge('u1', 'jti-1', codeAt(secret, 1))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a challenge superseded by a newer login', async () => {
    const { service, secret } = await enabledService();
    await service.startChallenge('u1', 'jti-old');
    await service.startChallenge('u1', 'jti-new');

    await expect(service.verifyChallenge('u1', 'jti-old', codeAt(secret))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(service.verifyChallenge('u1', 'jti-new', codeAt(secret))).resolves.toBeUndefined();
  });

  it('keeps the challenge after a wrong code below the cap', async () => {
    const { service, row, secret } = await enabledService();
    await service.startChallenge('u1', 'jti-1');

    await expect(service.verifyChallenge('u1', 'jti-1', '000000')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(row.mfaChallengeAttempts).toBe(1);
    await expect(service.verifyChallenge('u1', 'jti-1', codeAt(secret))).resolves.toBeUndefined();
  });

  it('drops the challenge after too many wrong codes and audits it', async () => {
    const { service, row, audit, secret } = await enabledService();
    await service.startChallenge('u1', 'jti-1');

    for (let i = 0; i < MAX_MFA_CHALLENGE_ATTEMPTS; i++) {
      await expect(
        service.verifyChallenge('u1', 'jti-1', '000000', '1.2.3.4'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    }
    expect(row.mfaChallengeJti).toBeNull();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'mfa.challenge_locked', actorUserId: 'u1' }),
    );
    // A correct code no longer helps: the user must restart from phone + OTP.
    await expect(service.verifyChallenge('u1', 'jti-1', codeAt(secret))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a challenge when MFA is not enabled', async () => {
    const { service } = makeService();
    await service.startChallenge('u1', 'jti-1');
    await expect(service.verifyChallenge('u1', 'jti-1', '123456')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
