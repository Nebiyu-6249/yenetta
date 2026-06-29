import { Module } from '@nestjs/common';
import { SrsController } from './srs.controller';
import { SrsService } from './srs.service';

@Module({
  controllers: [SrsController],
  providers: [SrsService],
})
export class SrsModule {}
