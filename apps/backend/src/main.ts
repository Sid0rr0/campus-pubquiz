import '@/instrument';
import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '@/app.module';
import { corsOriginValidator } from '@/config/cors.config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Behind Azure's proxy req.ip is the proxy; trust one hop so the throttler counts per client.
  app.set('trust proxy', 1);
  app.enableCors({ origin: corsOriginValidator, credentials: true });
  app.use(cookieParser());
  await app.listen(process.env.PORT ?? 3000);
}
// eslint-disable-next-line @typescript-eslint/no-floating-promises
bootstrap();
