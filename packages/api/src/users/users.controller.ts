import { Body, Controller, Get, Patch } from '@nestjs/common';
import type { Entitlement, UserProfile } from '@yenetta/shared';
import { CurrentUser, type AuthenticatedUser } from '../common/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { toUserProfile } from './user.mapper';
import { updateProfileSchema, type UpdateProfileDto } from './users.dto';
import { UsersService } from './users.service';

interface MeResponse {
  user: UserProfile;
  entitlement: Entitlement;
}

@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly entitlements: EntitlementsService,
  ) {}

  @Get('me')
  async me(@CurrentUser() current: AuthenticatedUser): Promise<MeResponse> {
    const user = await this.users.findById(current.userId);
    const entitlement = await this.entitlements.resolve(user.id);
    return { user: toUserProfile(user, entitlement.tier), entitlement };
  }

  @Patch('me')
  async updateMe(
    @CurrentUser() current: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateProfileSchema)) dto: UpdateProfileDto,
  ): Promise<MeResponse> {
    const user = await this.users.updateProfile(current.userId, dto);
    const entitlement = await this.entitlements.resolve(user.id);
    return { user: toUserProfile(user, entitlement.tier), entitlement };
  }
}
