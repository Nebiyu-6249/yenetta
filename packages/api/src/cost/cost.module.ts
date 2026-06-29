import { Module } from '@nestjs/common';
import { ModelRouter } from './model-router';
import { UsageService } from './usage.service';

@Module({
  providers: [ModelRouter, UsageService],
  exports: [ModelRouter, UsageService],
})
export class CostModule {}
