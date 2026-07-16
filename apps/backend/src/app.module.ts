import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DbModule } from './db/db.module';
import { SeedService } from './db/seed.service';
import { GameGateway } from './game/game.gateway';
import { GameStateService } from './game/game-state.service';

@Module({
  imports: [DbModule],
  controllers: [AppController],
  providers: [AppService, SeedService, GameStateService, GameGateway],
})
export class AppModule {}
