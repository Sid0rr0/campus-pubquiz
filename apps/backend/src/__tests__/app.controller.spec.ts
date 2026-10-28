import { AppController } from '@/app.controller';

describe('AppController', () => {
  it('answers the health check', () => {
    expect(new AppController().health()).toBe('OK');
  });
});
