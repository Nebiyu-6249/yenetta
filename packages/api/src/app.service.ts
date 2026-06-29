import { Injectable } from '@nestjs/common';
import { APP_NAME, APP_TAGLINE, APP_WORDMARK } from '@yenetta/shared';

export interface AppInfo {
  name: string;
  wordmark: string;
  tagline: string;
  status: 'ok';
}

@Injectable()
export class AppService {
  getInfo(): AppInfo {
    return {
      name: APP_NAME,
      wordmark: APP_WORDMARK,
      tagline: APP_TAGLINE,
      status: 'ok',
    };
  }
}
