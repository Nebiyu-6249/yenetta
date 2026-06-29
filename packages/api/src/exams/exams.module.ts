import { Module } from '@nestjs/common';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { ProgressModule } from '../progress/progress.module';
import { ExamsController } from './exams.controller';
import { ExamsService } from './exams.service';

@Module({
  imports: [ProgressModule, EntitlementsModule],
  controllers: [ExamsController],
  providers: [ExamsService],
})
export class ExamsModule {}
