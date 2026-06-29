import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile as UploadedFileDecorator,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { type IngestionOverrides } from '@yenetta/ingestion';
import { CurrentUser, type AuthenticatedUser } from '../common/current-user.decorator';
import { ContentService } from './content.service';

// NOTE: M2 protects admin endpoints with auth only; role-based admin access
// (an `isAdmin`/roles check) is layered on in a later milestone.
@Controller('admin/documents')
export class AdminController {
  constructor(private readonly content: ContentService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFileDecorator() file: Express.Multer.File | undefined,
    @Body() body: { subjectId?: string; chapterId?: string; year?: string; type?: string },
  ) {
    if (!file) {
      throw new BadRequestException('A file is required (form field "file")');
    }
    const overrides: IngestionOverrides = {
      subjectId: body.subjectId || undefined,
      chapterId: body.chapterId || undefined,
      year: body.year ? Number(body.year) : undefined,
      type: body.type === 'exam_question' ? 'exam_question' : undefined,
    };
    const doc = await this.content.upload(
      { filename: file.originalname, mimetype: file.mimetype, buffer: file.buffer },
      user.userId,
      overrides,
    );
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
