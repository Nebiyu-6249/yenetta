import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { type Env, validateEnv } from './env';

/** DI token for the validated, typed environment config. */
export const ENV = Symbol('ENV');

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      // Read the repo-root .env (shared by all workspaces) and a local override.
      envFilePath: ['../../.env', '.env'],
      validate: validateEnv,
    }),
  ],
  providers: [
    {
      provide: ENV,
      useFactory: (): Env => validateEnv(process.env),
    },
  ],
  exports: [ENV, NestConfigModule],
})
export class AppConfigModule {}
