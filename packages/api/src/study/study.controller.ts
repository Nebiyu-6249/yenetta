import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser, type AuthenticatedUser } from '../common/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { StudyService, type StudyResult } from './study.service';
import { submitQuizSchema, type SubmitQuizDto } from './study.dto';

@Controller()
export class StudyController {
  constructor(private readonly study: StudyService) {}

  @Get('chapters/:id/summary')
  summary(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<StudyResult> {
    return this.study.generate(user.userId, id, 'summary');
  }

  @Get('chapters/:id/notes')
  notes(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<StudyResult> {
    return this.study.generate(user.userId, id, 'notes');
  }

  @Get('chapters/:id/flashcards')
  flashcards(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<StudyResult> {
    return this.study.generate(user.userId, id, 'flashcards');
  }

  @Get('chapters/:id/quiz')
  quiz(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.study.getQuizForTaking(user.userId, id);
  }

  @Post('quizzes/:quizId/attempts')
  submitQuiz(
    @CurrentUser() user: AuthenticatedUser,
    @Param('quizId') quizId: string,
    @Body(new ZodValidationPipe(submitQuizSchema)) dto: SubmitQuizDto,
  ) {
    return this.study.submitQuiz(user.userId, quizId, dto.answers);
  }
}
