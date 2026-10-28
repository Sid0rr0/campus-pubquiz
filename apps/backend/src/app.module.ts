import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { SentryGlobalFilter, SentryModule } from '@sentry/nestjs/setup';
import { AppController } from '@/app.controller';
import { AuthController } from '@/auth/auth.controller';
import { AuthModule } from '@/auth/auth.module';
import { UsersController } from '@/auth/users.controller';
import { GameModule } from '@/game/game.module';
import { DbModule } from '@/db/db.module';
import { TeamPageController } from '@/team/team-page.controller';
import { TeamsController } from '@/team/teams.controller';
import { AnswerController } from '@/answer/answer.controller';
import {
  BonusAwardMutationsController,
  BonusAwardsController,
} from '@/bonus/bonus-awards.controller';
import { QuizController } from '@/quiz/quiz.controller';
import { ImportController } from '@/import/import.controller';
import { ImportService } from '@/import/import.service';
import { createMediaStorage } from '@/media/create-media-storage';
import { MEDIA_STORAGE } from '@/media/media-storage';
import { MediaController } from '@/media/media.controller';
import { MediaService } from '@/media/media.service';
import { LeaguesController } from '@/league/leagues.controller';
import { PublicLeaguesController } from '@/league/public-leagues.controller';
import { SessionsController } from '@/session/sessions.controller';
import { StatsController } from '@/stats/stats.controller';
import { StatsService } from '@/stats/stats.service';

@Module({
  imports: [
    // Must be the first module so Sentry's request-tracing hooks wrap
    // everything else Nest registers.
    SentryModule.forRoot(),
    // Only applied where routes opt in via @UseGuards(ThrottlerGuard) — the
    // login/register endpoints, which are now real password-based auth
    // targets rather than a single shared secret.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 5 }]),
    DbModule,
    AuthModule,
    GameModule,
  ],
  controllers: [
    AppController,
    AuthController,
    UsersController,
    ImportController,
    MediaController,
    QuizController,
    SessionsController,
    AnswerController,
    TeamsController,
    TeamPageController,
    BonusAwardsController,
    BonusAwardMutationsController,
    StatsController,
    LeaguesController,
    PublicLeaguesController,
  ],
  providers: [
    // Must be registered before any other exception filters so Sentry sees
    // unhandled errors before a custom filter can swallow them.
    { provide: APP_FILTER, useClass: SentryGlobalFilter },
    ImportService,
    { provide: MEDIA_STORAGE, useFactory: () => createMediaStorage() },
    MediaService,
    StatsService,
  ],
})
export class AppModule {}
