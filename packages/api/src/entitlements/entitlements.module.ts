import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EntitlementsController } from './entitlements.controller';
import { EntitlementsService } from './entitlements.service';
import { PremiumGuard } from './premium.guard';

@Module({
  imports: [JwtModule.register({})],
  controllers: [EntitlementsController],
  providers: [EntitlementsService, PremiumGuard],
  exports: [EntitlementsService, PremiumGuard],
})
export class EntitlementsModule {}
