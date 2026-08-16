import { createHash, randomUUID } from 'node:crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ENV } from '../config/config.module';
import { type Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

export interface AccessTokenPayload {
  sub: string;
  type: 'access';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async issueTokens(userId: string): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, type: 'access' },
      { secret: this.env.JWT_ACCESS_SECRET, expiresIn: this.env.ACCESS_TOKEN_TTL },
    );

    const expiresAt = new Date(Date.now() + this.env.REFRESH_TOKEN_TTL_DAYS * 24 * 3600 * 1000);
    const refreshToken = await this.jwt.signAsync(
      // `jti` guarantees every refresh token is unique even when two are issued
      // in the same second (otherwise identical claims → identical hash → clash).
      { sub: userId, type: 'refresh', jti: randomUUID() },
      { secret: this.env.JWT_REFRESH_SECRET, expiresIn: `${this.env.REFRESH_TOKEN_TTL_DAYS}d` },
    );

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash: this.hash(refreshToken), expiresAt },
    });

    return { accessToken, refreshToken };
  }

  /**
   * Short-lived token issued after the first factor (phone+OTP) passes but MFA
   * is still outstanding. It authorises only the `/auth/mfa/verify` step, never
   * API access, so a stolen challenge cannot reach protected routes.
   */
  async issueMfaChallengeToken(userId: string): Promise<string> {
    return this.jwt.signAsync(
      { sub: userId, type: 'mfa' },
      { secret: this.env.JWT_ACCESS_SECRET, expiresIn: '5m' },
    );
  }

  async verifyMfaChallengeToken(token: string): Promise<string> {
    let payload: { sub: string; type?: string };
    try {
      payload = await this.jwt.verifyAsync(token, { secret: this.env.JWT_ACCESS_SECRET });
    } catch {
      throw new UnauthorizedException('Invalid or expired MFA challenge');
    }
    if (payload.type !== 'mfa') {
      throw new UnauthorizedException('Wrong token type');
    }
    return payload.sub;
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
      secret: this.env.JWT_ACCESS_SECRET,
    });
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Wrong token type');
    }
    return payload;
  }

  /** Validates a refresh token, rotates it (revoke old, issue new pair). */
  async rotateRefreshToken(refreshToken: string): Promise<TokenPair> {
    let payload: { sub: string; type?: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Wrong token type');
    }

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(refreshToken) },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token is no longer valid');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(payload.sub);
  }
}
