import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentUser, type AuthenticatedUser } from '../common/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { reviewSchema, type ReviewDto } from './srs.dto';
import { SrsService } from './srs.service';

@Controller('srs')
export class SrsController {
  constructor(private readonly srs: SrsService) {}

  @Get('due')
  due(@CurrentUser() user: AuthenticatedUser, @Query('chapterId') chapterId?: string) {
    return this.srs.listDue(user.userId, chapterId);
  }

  @Post('review')
  review(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(reviewSchema)) dto: ReviewDto,
  ) {
    return this.srs.review(user.userId, dto.flashcardId, dto.grade);
  }
}
