import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { ENV } from '../config/config.module';
import { type Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { decryptSecret, encryptSecret } from './secret-cipher';
import { generateTotpSecret, otpauthUri, verifyTotp } from './totp';

export interface MfaEnrollment {
  /** Base32 secret to type into an authenticator app manually. */
  secret: string;
  /** otpauth:// URI to render as a QR code. */
  otpauthUri: string;
}

@Injectable()
export class MfaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Key material for encrypting stored secrets (dedicated key or derived). */
  private keyMaterial(): string {
    return this.env.MFA_ENCRYPTION_KEY ?? `${this.env.JWT_ACCESS_SECRET}:${this.env.JWT_REFRESH_SECRET}`;
  }

  /** True when the user must present a TOTP code to complete login. */
  isRequired(user: Pick<User, 'role' | 'mfaEnabled'>): boolean {
    return user.role === 'admin' && user.mfaEnabled;
  }

  async getStatus(userId: string): Promise<{ enabled: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true },
    });
    return { enabled: user?.mfaEnabled ?? false };
  }

  /**
   * Generates a new secret and stores it encrypted, leaving MFA disabled until
   * the user confirms a code. Re-enrolling overwrites any pending secret.
   */
  async beginEnrollment(userId: string, accountLabel: string): Promise<MfaEnrollment> {
    const secret = generateTotpSecret();
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: encryptSecret(secret, this.keyMaterial()), mfaEnabled: false },
    });
    return { secret, otpauthUri: otpauthUri(secret, accountLabel, this.env.MFA_ISSUER) };
  }

  /** Confirms enrollment by verifying a code against the pending secret. */
  async confirmEnrollment(userId: string, code: string, ip?: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mfaSecret: true, mfaEnabled: true },
    });
    if (!user?.mfaSecret) {
      throw new BadRequestException('No enrollment in progress');
    }
    if (!verifyTotp(decryptSecret(user.mfaSecret, this.keyMaterial()), code)) {
      throw new UnauthorizedException('Invalid authentication code');
    }
    if (!user.mfaEnabled) {
      await this.prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true } });
      await this.audit.record({ action: 'mfa.enabled', actorUserId: userId, ip });
    }
  }

  /** Verifies a login-time code for a user with MFA enabled. */
  async verifyCode(userId: string, code: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mfaSecret: true, mfaEnabled: true },
    });
    if (!user?.mfaEnabled || !user.mfaSecret) {
      return false;
    }
    return verifyTotp(decryptSecret(user.mfaSecret, this.keyMaterial()), code);
  }

  /** Disables MFA after re-verifying a current code (never on code alone). */
  async disable(userId: string, code: string, ip?: string): Promise<void> {
    if (!(await this.verifyCode(userId, code))) {
      throw new UnauthorizedException('Invalid authentication code');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: null, mfaEnabled: false },
    });
    await this.audit.record({ action: 'mfa.disabled', actorUserId: userId, ip });
  }
}
