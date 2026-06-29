import { Global, Module } from '@nestjs/common';
import { ENV } from '../config/config.module';
import { type Env } from '../config/env';
import { LLM_PROVIDER } from './llm/llm-provider.interface';
import { createLlmProvider } from './llm/llm.factory';
import { PAYMENT_PROVIDER } from './payment/payment-provider.interface';
import { createPaymentProvider } from './payment/payment.factory';
import { SMS_PROVIDER } from './sms/sms-provider.interface';
import { createSmsProvider } from './sms/sms.factory';

/**
 * Binds the swappable provider abstractions (LLM, SMS, Payment) to concrete
 * implementations chosen from config (BUILD_BRIEF §4.1, §7). Stubbed for M1.
 */
@Global()
@Module({
  providers: [
    { provide: LLM_PROVIDER, useFactory: (env: Env) => createLlmProvider(env), inject: [ENV] },
    { provide: SMS_PROVIDER, useFactory: (env: Env) => createSmsProvider(env), inject: [ENV] },
    {
      provide: PAYMENT_PROVIDER,
      useFactory: (env: Env) => createPaymentProvider(env),
      inject: [ENV],
    },
  ],
  exports: [LLM_PROVIDER, SMS_PROVIDER, PAYMENT_PROVIDER],
})
export class ProvidersModule {}
