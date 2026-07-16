import { Module } from '@nestjs/common';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { DbModule } from '@/db/db.module';
import { SeedService } from '@/db/seed.service';
import { GameGateway } from '@/game/game.gateway';
import { GameStateService } from '@/game/game-state.service';
import { TeamService } from '@/team/team.service';
import { AnswerService } from '@/answer/answer.service';

@Module({
  imports: [DbModule],
  controllers: [AppController],
  providers: [
    AppService,
    SeedService,
    TeamService,
    AnswerService,
    GameStateService,
    GameGateway,
  ],
})
export class AppModule {}
