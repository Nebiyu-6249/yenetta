import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { ContentService } from './content.service';
import { IngestionQueueService } from './ingestion-queue.service';

@Module({
  controllers: [AdminController],
  providers: [ContentService, IngestionQueueService],
  exports: [ContentService],
})
export class ContentModule {}
