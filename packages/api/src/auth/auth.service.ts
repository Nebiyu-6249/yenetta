import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { Entitlement, UserProfile } from '@yenetta/shared';
import { AuditService } from '../audit/audit.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { toUserProfile } from '../users/user.mapper';
import { UsersService } from '../users/users.service';
import { MfaService } from './mfa.service';
import { OtpService, type OtpRequestResult } from './otp.service';
import { TokenService } from './token.service';

export interface LoginResult {
  user: UserProfile;
  entitlement: Entitlement;
  accessToken: string;
  refreshToken: string;
}

/** Returned when the first factor passed but a TOTP code is still required. */
export interface MfaChallengeResult {
  mfaRequired: true;
  mfaToken: string;
}

export type VerifyOtpResult = LoginResult | MfaChallengeResult;

export function isMfaChallenge(result: VerifyOtpResult): result is MfaChallengeResult {
  return 'mfaRequired' in result;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
    private readonly users: UsersService,
    private readonly entitlements: EntitlementsService,
    private readonly mfa: MfaService,
    private readonly audit: AuditService,
  ) {}

  requestOtp(phone: string): Promise<OtpRequestResult> {
    return this.otp.requestOtp(phone);
  }

  async verifyAndLogin(phone: string, code: string, ip?: string): Promise<VerifyOtpResult> {
    const valid = await this.otp.verifyOtp(phone, code);
    if (!valid) {
      throw new UnauthorizedException('Invalid or expired code');
    }

    const user = await this.users.findOrCreateByPhone(phone);
    if (this.mfa.isRequired(user)) {
      return { mfaRequired: true, mfaToken: await this.tokens.issueMfaChallengeToken(user.id) };
    }
    return this.completeLogin(user, ip, false);
  }

  /** Second factor: validates the challenge token + TOTP code, then logs in. */
  async verifyMfaAndLogin(mfaToken: string, code: string, ip?: string): Promise<LoginResult> {
    const userId = await this.tokens.verifyMfaChallengeToken(mfaToken);
    if (!(await this.mfa.verifyCode(userId, code))) {
      throw new UnauthorizedException('Invalid authentication code');
    }
    const user = await this.users.findById(userId);
    return this.completeLogin(user, ip, true);
  }

  refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    return this.tokens.rotateRefreshToken(refreshToken);
  }

  private async completeLogin(user: User, ip: string | undefined, viaMfa: boolean): Promise<LoginResult> {
    const entitlement = await this.entitlements.resolve(user.id);
    const { accessToken, refreshToken } = await this.tokens.issueTokens(user.id);
    await this.audit.record({
      action: 'auth.login',
      actorUserId: user.id,
      ip,
      metadata: { tier: entitlement.tier, mfa: viaMfa },
    });
    return { user: toUserProfile(user, entitlement.tier), entitlement, accessToken, refreshToken };
  }
}
