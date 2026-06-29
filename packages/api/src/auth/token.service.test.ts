import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type Env } from '../config/env';
import { type PrismaService } from '../prisma/prisma.service';
import { TokenService } from './token.service';

function makeEnv(): Env {
  return {
    JWT_ACCESS_SECRET: 'access-secret',
    JWT_REFRESH_SECRET: 'refresh-secret',
    ACCESS_TOKEN_TTL: '15m',
    REFRESH_TOKEN_TTL_DAYS: 30,
  } as Env;
}

function makeService() {
  const prisma = {
    refreshToken: {
      create: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    },
  };
  const service = new TokenService(
    new JwtService({}),
    prisma as unknown as PrismaService,
    makeEnv(),
  );
  return { service, prisma };
}

describe('TokenService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('issues an access token that verifies back to the user id', async () => {
    const { service, prisma } = makeService();
    const { accessToken, refreshToken } = await service.issueTokens('user-1');

    expect(accessToken).toBeTruthy();
    expect(refreshToken).toBeTruthy();
    // Refresh token is persisted (hashed) for rotation/revocation.
    expect(prisma.refreshToken.create).toHaveBeenCalledOnce();

    const payload = await service.verifyAccessToken(accessToken);
    expect(payload.sub).toBe('user-1');
    expect(payload.type).toBe('access');
  });

  it('rejects a tampered/invalid access token', async () => {
    const { service } = makeService();
    await expect(service.verifyAccessToken('not-a-jwt')).rejects.toBeTruthy();
  });

  it('rejects a token signed with the access secret but the wrong type', async () => {
    const { service } = makeService();
    // Same secret as access tokens, but type=refresh → must fail the type guard.
    const wrongType = await new JwtService({}).signAsync(
      { sub: 'user-1', type: 'refresh' },
      { secret: 'access-secret' },
    );
    await expect(service.verifyAccessToken(wrongType)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rotates a valid, stored refresh token', async () => {
    const { service, prisma } = makeService();
    const { refreshToken } = await service.issueTokens('user-1');
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    const rotated = await service.rotateRefreshToken(refreshToken);
    expect(rotated.accessToken).toBeTruthy();
    // Old token revoked, new one persisted.
    expect(prisma.refreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ revokedAt: expect.any(Date) }) }),
    );
  });

  it('refuses a revoked refresh token', async () => {
    const { service, prisma } = makeService();
    const { refreshToken } = await service.issueTokens('user-1');
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt1',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    await expect(service.rotateRefreshToken(refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
