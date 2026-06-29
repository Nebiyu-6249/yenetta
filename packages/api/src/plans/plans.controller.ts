import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, type AuthenticatedUser } from '../common/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PremiumGuard } from '../entitlements/premium.guard';
import { generatePlanSchema, type GeneratePlanDto } from './plans.dto';
import { PlansService } from './plans.service';

// Personalized study plans are a Premium feature (BUILD_BRIEF §6).
@UseGuards(PremiumGuard)
@Controller('plans')
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Post()
  generate(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(generatePlanSchema)) dto: GeneratePlanDto,
  ) {
    return this.plans.generate(user.userId, dto.examDate, dto.dailyMinutes);
  }

  @Get('current')
  current(@CurrentUser() user: AuthenticatedUser) {
    return this.plans.getCurrent(user.userId);
  }

  @Post(':id/adapt')
  adapt(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.plans.adapt(user.userId, id);
  }

  @Post('items/:itemId/complete')
  complete(@CurrentUser() user: AuthenticatedUser, @Param('itemId') itemId: string) {
    return this.plans.completeItem(user.userId, itemId);
  }
}
