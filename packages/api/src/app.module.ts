import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { AppConfigModule } from './config/config.module';
import { CurriculumModule } from './curriculum/curriculum.module';
import { EntitlementsModule } from './entitlements/entitlements.module';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { ProvidersModule } from './providers/providers.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    ProvidersModule,
    AuthModule,
    UsersModule,
    EntitlementsModule,
    CurriculumModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    // Every route requires a valid access token unless marked @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
