import { describe, expect, it, vi } from 'vitest';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  it('records an event with actor, action, and ip', async () => {
    const prisma = { auditEvent: { create: vi.fn().mockResolvedValue({}) } };
    const service = new AuditService(prisma as never);
    await service.record({ action: 'auth.login', actorUserId: 'u1', ip: '1.2.3.4' });

    expect(prisma.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'auth.login', actorUserId: 'u1', ip: '1.2.3.4' }),
      }),
    );
  });

  it('never throws when the write fails (best-effort)', async () => {
    const prisma = { auditEvent: { create: vi.fn().mockRejectedValue(new Error('db down')) } };
    const service = new AuditService(prisma as never);
    await expect(service.record({ action: 'x' })).resolves.toBeUndefined();
  });

  it('redacts PII from metadata before persisting', async () => {
    const create = vi.fn().mockResolvedValue({});
    const service = new AuditService({ auditEvent: { create } } as never);
    await service.record({
      action: 'note.added',
      actorUserId: 'u1',
      metadata: { note: 'ping me at a@b.com or +251911223344' },
    });

    const persisted = create.mock.calls[0][0].data.metadata as { note: string };
    expect(persisted.note).toBe('ping me at [redacted-email] or [redacted-phone]');
  });
});
