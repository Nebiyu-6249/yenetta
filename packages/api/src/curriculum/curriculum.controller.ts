import { Controller, Get, Param, Query } from '@nestjs/common';
import type { Chapter, Subject } from '@prisma/client';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurriculumService } from './curriculum.service';
import { subjectQuerySchema, type SubjectQueryDto } from './curriculum.dto';

/**
 * Curriculum browse (BUILD_BRIEF §6). Auth-protected by the global JwtAuthGuard
 * — a logged-in student can list seeded subjects and drill into chapters.
 */
@Controller()
export class CurriculumController {
  constructor(private readonly curriculum: CurriculumService) {}

  @Get('subjects')
  listSubjects(
    @Query(new ZodValidationPipe(subjectQuerySchema)) query: SubjectQueryDto,
  ): Promise<Subject[]> {
    return this.curriculum.listSubjects(query);
  }

  @Get('subjects/:id')
  getSubject(@Param('id') id: string): Promise<Subject> {
    return this.curriculum.getSubject(id);
  }

  @Get('subjects/:id/chapters')
  listChapters(@Param('id') id: string): Promise<Chapter[]> {
    return this.curriculum.listChapters(id);
  }
}
