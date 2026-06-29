import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { EntitlementsService } from './entitlements.service';

/** Blocks non-premium users from premium-only endpoints (BUILD_BRIEF §6, §7). */
@Injectable()
export class PremiumGuard implements CanActivate {
  constructor(private readonly entitlements: EntitlementsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: { userId: string } }>();
    if (!request.user) {
      throw new UnauthorizedException();
    }
    const entitlement = await this.entitlements.resolve(request.user.userId);
    if (entitlement.tier !== 'premium') {
      throw new HttpException('Premium subscription required', HttpStatus.PAYMENT_REQUIRED);
    }
    return true;
  }
}
