import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Ip,
  Param,
  Post,
  UploadedFile as UploadedFileDecorator,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { type IngestionOverrides } from '@yenetta/ingestion';
import { AuditService } from '../audit/audit.service';
import { CurrentUser, type AuthenticatedUser } from '../common/current-user.decorator';
import { Roles } from '../common/roles.decorator';
import { ContentService } from './content.service';
import { MAX_UPLOAD_BYTES } from './upload-validation';

// Admin-only: only staff add reviewed curriculum/exam content (public), through
// this pipeline (SECURITY.md section 14, LLM04). Students upload their own
// private notes via POST /me/documents instead.
@Roles('admin')
@Controller('admin/documents')
export class AdminController {
  constructor(
    private readonly content: ContentService,
    private readonly audit: AuditService,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFileDecorator() file: Express.Multer.File | undefined,
    @Ip() ip: string,
    @Body()
    body: {
      subjectId?: string;
      chapterId?: string;
      year?: string;
      type?: string;
    },
  ) {
    if (!file) {
      throw new BadRequestException('A file is required (form field "file")');
    }
    // Admin uploads are always public curriculum/exam content.
    const overrides: IngestionOverrides = {
      subjectId: body.subjectId || undefined,
      chapterId: body.chapterId || undefined,
      year: body.year ? Number(body.year) : undefined,
      type: body.type === 'exam_question' ? 'exam_question' : undefined,
      visibility: 'public',
    };
    const doc = await this.content.upload(
      { filename: file.originalname, mimetype: file.mimetype, buffer: file.buffer },
      user.userId,
      overrides,
    );
    await this.audit.record({
      action: 'content.upload',
      actorUserId: user.userId,
      targetType: 'document',
      targetId: doc.id,
      ip,
      metadata: { visibility: doc.visibility, type: doc.type, status: doc.status },
    });
    return { id: doc.id, filename: doc.filename, status: doc.status };
  }

  @Get()
  list() {
    return this.content.list();
  }

  @Get(':id')
  async status(@Param('id') id: string) {
    const doc = await this.content.getStatus(id);
    if (!doc) {
      throw new BadRequestException('Document not found');
    }
    return { id: doc.id, filename: doc.filename, status: doc.status, type: doc.type };
  }
}
