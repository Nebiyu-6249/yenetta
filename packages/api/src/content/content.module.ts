import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { ContentService } from './content.service';
import { IngestionQueueService } from './ingestion-queue.service';
import { MeDocumentsController } from './me-documents.controller';

@Module({
  controllers: [AdminController, MeDocumentsController],
  providers: [ContentService, IngestionQueueService],
  exports: [ContentService],
})
export class ContentModule {}
