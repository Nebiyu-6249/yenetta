import { describe, expect, it } from 'vitest';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  const controller = new AppController(new AppService());

  it('returns branded app info with ok status', () => {
    const info = controller.getRoot();
    expect(info.name).toBe('Yenetta');
    expect(info.wordmark).toBe('Yenetta AI');
    expect(info.status).toBe('ok');
  });
});
