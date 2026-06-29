import { Module } from '@nestjs/common';
import { CostModule } from '../cost/cost.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { ProgressModule } from '../progress/progress.module';
import { StudyController } from './study.controller';
import { StudyService } from './study.service';

@Module({
  imports: [EntitlementsModule, CostModule, ProgressModule],
  controllers: [StudyController],
  providers: [StudyService],
})
export class StudyModule {}
