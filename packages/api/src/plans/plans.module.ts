import { Module } from '@nestjs/common';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';

@Module({
  imports: [EntitlementsModule],
  controllers: [PlansController],
  providers: [PlansService],
})
export class PlansModule {}
