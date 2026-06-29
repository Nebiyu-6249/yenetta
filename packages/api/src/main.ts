import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.setGlobalPrefix('api');

  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port);
  Logger.log(`🔥 Yenetta API listening on http://localhost:${port}/api`, 'Bootstrap');
}

void bootstrap();
