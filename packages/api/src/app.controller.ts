import { Controller, Get } from '@nestjs/common';
import { Public } from './common/public.decorator';
import { AppService, type AppInfo } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  getRoot(): AppInfo {
    return this.appService.getInfo();
  }
}
