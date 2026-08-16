import { Body, Controller, Get, HttpCode, HttpStatus, Ip, Post } from '@nestjs/common';
import { CurrentUser, type AuthenticatedUser } from '../common/current-user.decorator';
import { Roles } from '../common/roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { UsersService } from '../users/users.service';
import { mfaCodeSchema, type MfaCodeDto } from './auth.dto';
import { MfaService, type MfaEnrollment } from './mfa.service';

/**
 * Admin-only TOTP enrollment. Login enforcement lives in AuthService; these
 * routes let an authenticated admin set up, confirm, inspect, or remove their
 * second factor. Gated to the admin role because MFA is required only there.
 */
@Roles('admin')
@Controller('me/mfa')
export class MfaController {
  constructor(
    private readonly mfa: MfaService,
    private readonly users: UsersService,
  ) {}

  @Get()
  status(@CurrentUser() user: AuthenticatedUser): Promise<{ enabled: boolean }> {
    return this.mfa.getStatus(user.userId);
  }

  @Post('enroll')
  @HttpCode(HttpStatus.OK)
  async enroll(@CurrentUser() user: AuthenticatedUser): Promise<MfaEnrollment> {
    const account = await this.users.findById(user.userId);
    return this.mfa.beginEnrollment(user.userId, account.phone);
  }

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  async confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(mfaCodeSchema)) dto: MfaCodeDto,
    @Ip() ip: string,
  ): Promise<{ enabled: boolean }> {
    await this.mfa.confirmEnrollment(user.userId, dto.code, ip);
    return { enabled: true };
  }

  @Post('disable')
  @HttpCode(HttpStatus.OK)
  async disable(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(mfaCodeSchema)) dto: MfaCodeDto,
    @Ip() ip: string,
  ): Promise<{ enabled: boolean }> {
    await this.mfa.disable(user.userId, dto.code, ip);
    return { enabled: false };
  }
}
