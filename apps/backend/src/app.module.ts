import { Module } from '@nestjs/common';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { DbModule } from '@/db/db.module';
import { SeedService } from '@/db/seed.service';
import { GameGateway } from '@/game/game.gateway';
import { GameProgressRepository } from '@/game/game-progress.repository';
import { GameStateService } from '@/game/game-state.service';
import { TeamService } from '@/team/team.service';
import { AnswerService } from '@/answer/answer.service';
import { BonusService } from '@/bonus/bonus.service';
import { QuizService } from '@/quiz/quiz.service';
import { QuizController } from '@/quiz/quiz.controller';
import { ImportController } from '@/import/import.controller';
import { ImportService } from '@/import/import.service';

@Module({
  imports: [DbModule],
  controllers: [AppController, ImportController, QuizController],
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
