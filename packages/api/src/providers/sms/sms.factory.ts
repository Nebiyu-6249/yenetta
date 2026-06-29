import { Logger, NotImplementedException } from '@nestjs/common';
import { type Env } from '../../config/env';
import { MockSmsProvider } from './mock-sms.provider';
import { type SmsProvider } from './sms-provider.interface';

/** Adapter skeleton for real SMS gateways (AfroMessage / Twilio) — wired in a later milestone. */
class UnconfiguredSmsProvider implements SmsProvider {
  constructor(readonly name: string) {}
  async sendOtp(): Promise<void> {
    new Logger('Sms').warn(`SMS provider "${this.name}" not implemented yet`);
    throw new NotImplementedException(`SMS provider "${this.name}" is not wired up yet`);
  }
}

export function createSmsProvider(env: Env): SmsProvider {
  switch (env.SMS_PROVIDER) {
    case 'mock':
      return new MockSmsProvider();
    case 'afromessage':
    case 'twilio':
      return new UnconfiguredSmsProvider(env.SMS_PROVIDER);
    default:
      return new MockSmsProvider();
  }
}
