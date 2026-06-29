import { Controller, Get } from '@nestjs/common';
import { CurrentUser, type AuthenticatedUser } from '../common/current-user.decorator';
import { ProgressService, type ProgressSummary } from './progress.service';

@Controller('progress')
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  @Get()
  summary(@CurrentUser() user: AuthenticatedUser): Promise<ProgressSummary> {
    return this.progress.getSummary(user.userId);
  }
}
