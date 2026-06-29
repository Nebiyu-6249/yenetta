import { Module } from '@nestjs/common';
import { ProgressModule } from '../progress/progress.module';
import { GamificationController } from './gamification.controller';
import { StatsService } from './stats.service';

@Module({
  imports: [ProgressModule],
  controllers: [GamificationController],
  providers: [StatsService],
  exports: [StatsService],
})
export class GamificationModule {}
