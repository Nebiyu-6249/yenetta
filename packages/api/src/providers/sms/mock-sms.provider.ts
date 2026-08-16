import { Logger } from '@nestjs/common';
import { type SmsProvider } from './sms-provider.interface';

/**
 * Dev SMS provider: logs the OTP instead of sending it, so the code is visible
 * in the API logs (M1 acceptance). Never use in production.
 */
export class MockSmsProvider implements SmsProvider {
  readonly name = 'mock';
  private readonly logger = new Logger('MockSms');

  async sendOtp(phone: string, code: string): Promise<void> {
    this.logger.log(`OTP for ${phone}: ${code} (mock SMS — dev only)`);
  }
}
