import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RateLimitGuard } from './common/rate-limit.guard';
import { RateLimiterService } from './common/rate-limiter.service';
import { ChatModule } from './chat/chat.module';
import { AppConfigModule } from './config/config.module';
import { ContentModule } from './content/content.module';
import { CostModule } from './cost/cost.module';
import { CurriculumModule } from './curriculum/curriculum.module';
import { EntitlementsModule } from './entitlements/entitlements.module';
import { ExamsModule } from './exams/exams.module';
import { GamificationModule } from './gamification/gamification.module';
import { HealthController } from './health/health.controller';
import { MemoryModule } from './memory/memory.module';
import { PlansModule } from './plans/plans.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProgressModule } from './progress/progress.module';
import { ProvidersModule } from './providers/providers.module';
import { RetrievalModule } from './retrieval/retrieval.module';
import { SrsModule } from './srs/srs.module';
import { StudyModule } from './study/study.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    AuditModule,
    ProvidersModule,
    AuthModule,
    UsersModule,
    EntitlementsModule,
    CurriculumModule,
    CostModule,
    RetrievalModule,
    ChatModule,
    ContentModule,
    ProgressModule,
    StudyModule,
    SrsModule,
    ExamsModule,
    PaymentsModule,
    MemoryModule,
    GamificationModule,
    PlansModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    // Per-route + per-IP rate limiting on @RateLimit() routes (runs first).
    RateLimiterService,
    { provide: APP_GUARD, useClass: RateLimitGuard },
    // Every route requires a valid access token unless marked @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
