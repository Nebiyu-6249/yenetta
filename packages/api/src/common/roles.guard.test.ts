import { ForbiddenException } from '@nestjs/common';
import { type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { RolesGuard } from './roles.guard';

function makeContext(user?: { userId: string }): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function makeGuard(roles: string[] | undefined, dbRole?: string) {
  const reflector = { getAllAndOverride: vi.fn().mockReturnValue(roles) } as unknown as Reflector;
  const prisma = {
    user: { findUnique: vi.fn().mockResolvedValue(dbRole ? { role: dbRole } : null) },
  };
  return new RolesGuard(reflector, prisma as never);
}

describe('RolesGuard', () => {
  it('allows undecorated routes (no roles metadata)', async () => {
    await expect(makeGuard(undefined).canActivate(makeContext())).resolves.toBe(true);
  });

  it('allows a user whose role matches', async () => {
    const guard = makeGuard(['admin'], 'admin');
    await expect(guard.canActivate(makeContext({ userId: 'u1' }))).resolves.toBe(true);
  });

  it('denies a user whose role does not match', async () => {
    const guard = makeGuard(['admin'], 'student');
    await expect(guard.canActivate(makeContext({ userId: 'u1' }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('denies when there is no authenticated user', async () => {
    const guard = makeGuard(['admin']);
    await expect(guard.canActivate(makeContext())).rejects.toBeInstanceOf(ForbiddenException);
  });
});
