import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser, type AuthenticatedUser } from '../common/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ProgressService } from '../progress/progress.service';
import { optInSchema, type OptInDto } from './gamification.dto';
import { StatsService } from './stats.service';

@Controller()
export class GamificationController {
  constructor(
    private readonly stats: StatsService,
    private readonly progress: ProgressService,
  ) {}

  @Get('stats')
  myStats(@CurrentUser() user: AuthenticatedUser) {
    return this.stats.getStats(user.userId);
  }

  @Post('stats/leaderboard-opt-in')
  optIn(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(optInSchema)) dto: OptInDto,
  ) {
    return this.stats.setLeaderboardOptIn(user.userId, dto.optIn);
  }

  @Get('leaderboard')
  leaderboard() {
    return this.stats.leaderboard();
  }

  /** Deep analytics: progress + weak areas + gamification stats in one call. */
  @Get('analytics')
  async analytics(@CurrentUser() user: AuthenticatedUser) {
    const [summary, stats] = await Promise.all([
      this.progress.getSummary(user.userId),
      this.stats.getStats(user.userId),
    ]);
    return { ...summary, stats };
  }
}
