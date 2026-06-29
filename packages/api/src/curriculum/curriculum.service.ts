import { Injectable, NotFoundException } from '@nestjs/common';
import type { Chapter, Subject } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface SubjectFilter {
  grade?: number;
  stream?: 'natural' | 'social' | 'both';
}

@Injectable()
export class CurriculumService {
  constructor(private readonly prisma: PrismaService) {}

  listSubjects(filter: SubjectFilter = {}): Promise<Subject[]> {
    return this.prisma.subject.findMany({
      where: {
        grade: filter.grade,
        stream: filter.stream,
      },
      orderBy: [{ grade: 'asc' }, { name: 'asc' }],
    });
  }

  async getSubject(id: string): Promise<Subject> {
    const subject = await this.prisma.subject.findUnique({ where: { id } });
    if (!subject) {
      throw new NotFoundException('Subject not found');
    }
    return subject;
  }

  async listChapters(subjectId: string): Promise<Chapter[]> {
    await this.getSubject(subjectId);
    return this.prisma.chapter.findMany({
      where: { subjectId },
      orderBy: { unitNo: 'asc' },
    });
  }
}
