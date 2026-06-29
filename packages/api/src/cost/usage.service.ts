import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { Entitlement } from '@yenetta/shared';
import { PrismaService } from '../prisma/prisma.service';
import { estimateCost } from './pricing';

export interface UsageRecord {
  userId: string | null;
  feature: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
}

/**
 * Usage logging + quota enforcement (BUILD_BRIEF §8). Every AI call logs a
 * usage_event with an estimated cost; quotas are enforced server-side per tier.
 */
@Injectable()
export class UsageService {
  private readonly logger = new Logger(UsageService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(record: UsageRecord): Promise<void> {
    const inputTokens = record.inputTokens ?? 0;
    const outputTokens = record.outputTokens ?? 0;
    const costEstimate = record.model ? estimateCost(record.model, inputTokens, outputTokens) : 0;
    await this.prisma.usageEvent.create({
      data: {
        userId: record.userId,
        feature: record.feature,
        model: record.model,
        inputTokens,
        outputTokens,
        costEstimate,
      },
    });
  }

  /** Count of a user's AI events for a feature since the start of today (UTC). */
  async countToday(userId: string, features: string[]): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    return this.prisma.usageEvent.count({
      where: { userId, feature: { in: features }, createdAt: { gte: startOfDay } },
    });
  }

  /**
   * Throws 429 when the user has hit their daily AI cap. Enforced BEFORE the
   * spend so worst-case cost stays bounded.
   */
  async enforceDailyAiQuota(userId: string, entitlement: Entitlement): Promise<void> {
    const used = await this.countToday(userId, ['ai_chat', 'ai_generation']);
    if (used >= entitlement.quotas.dailyAiLimit) {
      this.logger.warn(
        `User ${userId} hit daily AI quota (${used}/${entitlement.quotas.dailyAiLimit})`,
      );
      throw new HttpException(
        `Daily AI limit reached (${entitlement.quotas.dailyAiLimit}). Upgrade to Premium for more.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
