import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEventInput {
  action: string;
  actorUserId?: string;
  targetType?: string;
  targetId?: string;
  ip?: string;
  /** Small, non-sensitive fields only - never secrets, tokens, or user content. */
  metadata?: Record<string, unknown>;
}

/**
 * Append-only audit log for security/admin actions (SECURITY.md section 9).
 * Writes are best-effort: an audit failure is logged but never breaks the
 * request. Never records secrets or PII beyond the actor id + IP.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit');

  constructor(private readonly prisma: PrismaService) {}

  async record(event: AuditEventInput): Promise<void> {
    try {
      await this.prisma.auditEvent.create({
        data: {
          action: event.action,
          actorUserId: event.actorUserId ?? null,
          targetType: event.targetType ?? null,
          targetId: event.targetId ?? null,
          ip: event.ip ?? null,
          metadata: (event.metadata as object | undefined) ?? undefined,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to write audit event "${event.action}": ${String(err)}`);
    }
  }

  list(limit = 100) {
    return this.prisma.auditEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
    });
  }
}
