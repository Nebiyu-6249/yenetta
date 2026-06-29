import { Controller, Get } from '@nestjs/common';
import { AppService, type AppInfo } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getRoot(): AppInfo {
    return this.appService.getInfo();
  }
}
