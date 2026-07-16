import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GameGateway } from './game/game.gateway';
import { GameStateService } from './game/game-state.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, GameStateService, GameGateway],
})
export class AppModule {}
