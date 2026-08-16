import {
  BadRequestException,
  Controller,
  Get,
  Ip,
  Post,
  UploadedFile as UploadedFileDecorator,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuditService } from '../audit/audit.service';
import { CurrentUser, type AuthenticatedUser } from '../common/current-user.decorator';
import { ContentService } from './content.service';
import { MAX_UPLOAD_BYTES } from './upload-validation';

/**
 * A student's own document uploads. Always PRIVATE and owned by the uploader,
 * so they can never be retrieved into another user's answers (LLM04/LLM08).
 */
@Controller('me/documents')
export class MeDocumentsController {
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
  ) {
    if (!file) {
      throw new BadRequestException('A file is required (form field "file")');
    }
    const doc = await this.content.upload(
      { filename: file.originalname, mimetype: file.mimetype, buffer: file.buffer },
      user.userId,
      { visibility: 'private' },
    );
    await this.audit.record({
      action: 'content.upload',
      actorUserId: user.userId,
      targetType: 'document',
      targetId: doc.id,
      ip,
      metadata: { visibility: 'private', personal: true },
    });
    return { id: doc.id, filename: doc.filename, status: doc.status };
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.content.listForUploader(user.userId);
  }
}
