import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { AppModule } from './app.module';
import { validateEnv } from './config/env';

async function bootstrap(): Promise<void> {
  const env = validateEnv(process.env);

  // rawBody lets the Chapa webhook verify its HMAC signature over the raw payload.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

  // Security headers (SECURITY.md section 1): HSTS w/ preload, nosniff,
  // frame-ancestors/clickjacking, referrer + a conservative API CSP.
  app.use(
    helmet({
      hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
      referrerPolicy: { policy: 'no-referrer' },
      crossOriginResourcePolicy: { policy: 'same-site' },
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
        },
      },
    }),
  );

  // CORS locked to an explicit allowlist (no "*").
  const allowlist = env.CORS_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: allowlist,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // Cap request bodies to reject oversized payloads (SECURITY.md section 3).
  app.useBodyParser('json', { limit: env.REQUEST_BODY_LIMIT });
  app.useBodyParser('urlencoded', { limit: env.REQUEST_BODY_LIMIT, extended: true });

  app.setGlobalPrefix('api');
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.listen(env.API_PORT);
  Logger.log(`Yenetta API listening on http://localhost:${env.API_PORT}/api`, 'Bootstrap');
}

void bootstrap();
