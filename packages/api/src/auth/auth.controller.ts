import { Body, Controller, HttpCode, HttpStatus, Ip, Post } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { Public } from '../common/public.decorator';
import { RateLimit } from '../common/rate-limit.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthService, type LoginResult } from './auth.service';
import {
  refreshSchema,
  requestOtpSchema,
  verifyOtpSchema,
  type RefreshDto,
  type RequestOtpDto,
  type VerifyOtpDto,
} from './auth.dto';
import { type OtpRequestResult } from './otp.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly audit: AuditService,
  ) {}

  @Public()
  @RateLimit({ limit: 5, windowMs: 60_000 })
  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  requestOtp(
    @Body(new ZodValidationPipe(requestOtpSchema)) dto: RequestOtpDto,
  ): Promise<OtpRequestResult> {
    return this.auth.requestOtp(dto.phone);
  }

  @Public()
  @RateLimit({ limit: 10, windowMs: 60_000 })
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(
    @Body(new ZodValidationPipe(verifyOtpSchema)) dto: VerifyOtpDto,
    @Ip() ip: string,
  ): Promise<LoginResult> {
    const result = await this.auth.verifyAndLogin(dto.phone, dto.code);
    await this.audit.record({
      action: 'auth.login',
      actorUserId: result.user.id,
      ip,
      metadata: { tier: result.entitlement.tier },
    });
    return result;
  }

  @Public()
  @RateLimit({ limit: 30, windowMs: 60_000 })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(
    @Body(new ZodValidationPipe(refreshSchema)) dto: RefreshDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return this.auth.refresh(dto.refreshToken);
  }
}
