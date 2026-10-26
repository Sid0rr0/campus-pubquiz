import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  // Render's health check (render.yaml) only needs a 200 here.
  @Get()
  health(): string {
    return 'OK';
  }
}
