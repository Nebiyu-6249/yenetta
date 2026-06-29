import { createHmac, randomInt } from 'node:crypto';
import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ENV } from '../config/config.module';
import { type Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { SMS_PROVIDER, type SmsProvider } from '../providers/sms/sms-provider.interface';

export const MAX_OTP_ATTEMPTS = 5;

export interface OtpRequestResult {
  expiresAt: Date;
  /** Returned only in non-production so the dev sees the code without SMS. */
  devCode?: string;
}

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Deterministic, peppered hash so codes are never stored in plaintext. */
  hashCode(phone: string, code: string): string {
    return createHmac('sha256', this.env.JWT_ACCESS_SECRET)
      .update(`${phone}:${code}`)
      .digest('hex');
  }

  generateCode(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  async requestOtp(phone: string): Promise<OtpRequestResult> {
    const since = new Date(Date.now() - 3600 * 1000);
    const recent = await this.prisma.authOtp.count({
      where: { phone, createdAt: { gte: since } },
    });
    if (recent >= this.env.OTP_RATE_LIMIT_PER_HOUR) {
      throw new HttpException(
        'Too many OTP requests. Please wait before trying again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + this.env.OTP_TTL_SECONDS * 1000);
    await this.prisma.authOtp.create({
      data: { phone, codeHash: this.hashCode(phone, code), expiresAt },
    });

    await this.sms.sendOtp(phone, code);

    return {
      expiresAt,
      devCode: this.env.NODE_ENV === 'production' ? undefined : code,
    };
  }

  /** Returns true and consumes the OTP on success; otherwise false. */
  async verifyOtp(phone: string, code: string): Promise<boolean> {
    const otp = await this.prisma.authOtp.findFirst({
      where: { phone, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) {
      return false;
    }
    if (otp.attempts >= MAX_OTP_ATTEMPTS) {
      return false;
    }

    if (this.hashCode(phone, code) === otp.codeHash) {
      await this.prisma.authOtp.update({
        where: { id: otp.id },
        data: { consumedAt: new Date() },
      });
      return true;
    }

    await this.prisma.authOtp.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    return false;
  }
}
