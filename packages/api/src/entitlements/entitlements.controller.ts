import { Controller, Get } from '@nestjs/common';
import { CurrentUser, type AuthenticatedUser } from '../common/current-user.decorator';
import { EntitlementsService, type SignedEntitlement } from './entitlements.service';

@Controller('entitlements')
export class EntitlementsController {
  constructor(private readonly entitlements: EntitlementsService) {}

  @Get()
  resolve(@CurrentUser() user: AuthenticatedUser) {
    return this.entitlements.resolve(user.userId);
  }

  /** Signed token the mobile app caches for offline entitlement gating. */
  @Get('token')
  token(@CurrentUser() user: AuthenticatedUser): Promise<SignedEntitlement> {
    return this.entitlements.issueSignedToken(user.userId);
  }
}
