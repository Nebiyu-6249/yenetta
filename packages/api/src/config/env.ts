import { z } from 'zod';

/**
 * Single source of truth for environment configuration. Validated at boot so
 * the API fails fast on misconfiguration (BUILD_BRIEF §12). Most values have
 * dev-friendly defaults so the app boots from `.env.example` without secrets.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  SITE_URL: z.string().default('https://www.yenetta.com'),

  DATABASE_URL: z.string().default('postgresql://yenetta:yenetta@localhost:5432/yenetta'),
  CONTENT_DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_ACCESS_SECRET: z.string().default('changeme'),
  JWT_REFRESH_SECRET: z.string().default('changeme-refresh'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  OTP_RATE_LIMIT_PER_HOUR: z.coerce.number().int().positive().default(5),

  LLM_PROVIDER: z.enum(['openai', 'stub']).default('openai'),
  OPENAI_API_KEY: z.string().optional(),
  LLM_MODEL_CHEAP: z.string().default('gpt-4o-mini'),
  LLM_MODEL_STANDARD: z.string().default('gpt-4.1-mini'),
  LLM_MODEL_HARD: z.string().default('gpt-4.1'),
  EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),

  SMS_PROVIDER: z.enum(['mock', 'afromessage', 'twilio']).default('mock'),
  SMS_API_KEY: z.string().optional(),

  PAYMENT_PROVIDER: z.enum(['chapa']).default('chapa'),
  CHAPA_MODE: z.enum(['sandbox', 'live']).default('sandbox'),
  CHAPA_SECRET_KEY: z.string().optional(),
  CHAPA_WEBHOOK_SECRET: z.string().optional(),

  // inline = API runs the pipeline synchronously (no worker needed, great for
  // dev); queue = API enqueues to BullMQ and the ingestion worker processes it.
  INGESTION_MODE: z.enum(['inline', 'queue']).default('inline'),

  FREE_TIER_DAILY_AI_LIMIT: z.coerce.number().int().nonnegative().default(20),
  PREMIUM_TIER_DAILY_AI_LIMIT: z.coerce.number().int().nonnegative().default(300),
  RETRIEVAL_TOP_K: z.coerce.number().int().positive().default(6),
  MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().default(1200),
});

export type Env = z.infer<typeof envSchema>;

/** Used by `ConfigModule.forRoot({ validate })`. */
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
