import { Module } from '@nestjs/common';
import { CostModule } from '../cost/cost.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { RetrievalModule } from '../retrieval/retrieval.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ResponseCacheService } from './response-cache.service';

@Module({
  imports: [RetrievalModule, EntitlementsModule, CostModule],
  controllers: [ChatController],
  providers: [ChatService, ResponseCacheService],
})
export class ChatModule {}
