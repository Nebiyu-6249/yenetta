import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser, type AuthenticatedUser } from '../common/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ChatService, type ChatResult } from './chat.service';
import { chatRequestSchema, type ChatRequestDto } from './chat.dto';

@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Post()
  send(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(chatRequestSchema)) dto: ChatRequestDto,
  ): Promise<ChatResult> {
    return this.chat.chat(user.userId, dto.message, dto.scope ?? {}, dto.conversationId, dto.language);
  }

  @Get('conversations')
  async conversations(@CurrentUser() user: AuthenticatedUser) {
    return this.chat.listConversations(user.userId);
  }

  @Get('conversations/:id')
  async messages(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.chat.getMessages(user.userId, id);
  }
}
