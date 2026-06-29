import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { Entitlement, UserProfile } from '@yenetta/shared';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { toUserProfile } from '../users/user.mapper';
import { UsersService } from '../users/users.service';
import { OtpService, type OtpRequestResult } from './otp.service';
import { TokenService } from './token.service';

export interface LoginResult {
  user: UserProfile;
  entitlement: Entitlement;
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
    private readonly users: UsersService,
    private readonly entitlements: EntitlementsService,
  ) {}

  requestOtp(phone: string): Promise<OtpRequestResult> {
    return this.otp.requestOtp(phone);
  }

  async verifyAndLogin(phone: string, code: string): Promise<LoginResult> {
    const valid = await this.otp.verifyOtp(phone, code);
    if (!valid) {
      throw new UnauthorizedException('Invalid or expired code');
    }

    const user = await this.users.findOrCreateByPhone(phone);
    const entitlement = await this.entitlements.resolve(user.id);
    const { accessToken, refreshToken } = await this.tokens.issueTokens(user.id);

    return {
      user: toUserProfile(user, entitlement.tier),
      entitlement,
      accessToken,
      refreshToken,
    };
  }

  refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    return this.tokens.rotateRefreshToken(refreshToken);
  }
}
