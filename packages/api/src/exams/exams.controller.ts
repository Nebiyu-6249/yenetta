import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, type AuthenticatedUser } from '../common/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PremiumGuard } from '../entitlements/premium.guard';
import {
  practiceQuerySchema,
  submitMockSchema,
  submitPracticeSchema,
  type PracticeQueryDto,
  type SubmitMockDto,
  type SubmitPracticeDto,
} from './exams.dto';
import { ExamsService } from './exams.service';

@Controller('exams')
export class ExamsController {
  constructor(private readonly exams: ExamsService) {}

  @Get('papers')
  papers(@Query('subjectId') subjectId?: string, @Query('year') year?: string) {
    return this.exams.listPapers({ subjectId, year: year ? Number(year) : undefined });
  }

  @Get('practice')
  practice(@Query(new ZodValidationPipe(practiceQuerySchema)) query: PracticeQueryDto) {
    return this.exams.practiceQuestions(query);
  }

  // Download full questions (with answers) for offline mobile practice.
  @Get('practice/download')
  download(@Query(new ZodValidationPipe(practiceQuerySchema)) query: PracticeQueryDto) {
    return this.exams.downloadQuestions(query);
  }

  @Post('practice/submit')
  submitPractice(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(submitPracticeSchema)) dto: SubmitPracticeDto,
  ) {
    return this.exams.submitPractice(user.userId, dto.answers);
  }

  @Get('mocks')
  mocks() {
    return this.exams.listMocks();
  }

  // Timed mock exams are a Premium feature (BUILD_BRIEF §6).
  @UseGuards(PremiumGuard)
  @Post('mocks/:id/start')
  startMock(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.exams.startMock(user.userId, id);
  }

  @Post('mocks/attempts/:attemptId/submit')
  submitMock(
    @CurrentUser() user: AuthenticatedUser,
    @Param('attemptId') attemptId: string,
    @Body(new ZodValidationPipe(submitMockSchema)) dto: SubmitMockDto,
  ) {
    return this.exams.submitMock(user.userId, attemptId, dto.answers, dto.durationSeconds);
  }
}
