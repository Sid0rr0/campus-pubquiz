import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { AuthController } from '@/auth/auth.controller';
import { AuthModule } from '@/auth/auth.module';
import { UsersController } from '@/auth/users.controller';
import { DbModule } from '@/db/db.module';
import { SeedService } from '@/db/seed.service';
import { GameGateway } from '@/game/game.gateway';
import { GameProgressRepository } from '@/game/state/game-progress.repository';
import { GameStateService } from '@/game/state/game-state.service';
import { TeamService } from '@/team/team.service';
import { TeamsController } from '@/team/teams.controller';
import { AnswerController } from '@/answer/answer.controller';
import { AnswerService } from '@/answer/answer.service';
import {
  BonusAwardMutationsController,
  BonusAwardsController,
} from '@/bonus/bonus-awards.controller';
import { BonusService } from '@/bonus/bonus.service';
import { QuizService } from '@/quiz/quiz.service';
import { QuizController } from '@/quiz/quiz.controller';
import { ImportController } from '@/import/import.controller';
import { ImportService } from '@/import/import.service';
import { SessionsController } from '@/session/sessions.controller';

@Module({
  imports: [
    // Only applied where routes opt in via @UseGuards(ThrottlerGuard) — the
    // login/register endpoints, which are now real password-based auth
    // targets rather than a single shared secret.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 5 }]),
    DbModule,
    AuthModule,
  ],
  controllers: [
    AppController,
    AuthController,
    UsersController,
    ImportController,
    QuizController,
    SessionsController,
    AnswerController,
    TeamsController,
    BonusAwardsController,
    BonusAwardMutationsController,
  ],
  providers: [
    AppService,
    SeedService,
    TeamService,
    AnswerService,
    BonusService,
    QuizService,
    GameProgressRepository,
    GameStateService,
    GameGateway,
    ImportService,
  ],
})
export class AppModule {}
