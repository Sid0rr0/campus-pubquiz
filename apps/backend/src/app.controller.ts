import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  // The host's health check only needs a 200 here.
  @Get()
  health(): string {
    return 'OK';
  }
}
