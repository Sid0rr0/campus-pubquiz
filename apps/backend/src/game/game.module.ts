import { Module } from '@nestjs/common';
import { AnswerService } from '@/answer/answer.service';
import { AuthModule } from '@/auth/auth.module';
import { SeedService } from '@/db/seed.service';
import { BonusService } from '@/bonus/bonus.service';
import { FeedbackService } from '@/feedback/feedback.service';
import { GameGateway } from '@/game/game.gateway';
import { LiveEditService } from '@/game/live-edit/live-edit.service';
import { SessionBroadcaster } from '@/game/socket/session-broadcaster';
import { BlockGradingService } from '@/game/state/block-grading.service';
import { GameProgressRepository } from '@/game/state/game-progress.repository';
import { GameStateService } from '@/game/state/game-state.service';
import { SessionWrite } from '@/game/state/session-write';
import { PlayerCountService } from '@/player-count/player-count.service';
import { QuizService } from '@/quiz/quiz.service';
import { ShowdownService } from '@/showdown/showdown.service';
import { StandingsService } from '@/standings/standings.service';
import { TeamService } from '@/team/team.service';

/**
 * The live game: the Live session module, Session write, Block grading, the
 * gateway and the Live edit module, plus the domain providers they depend on.
 * Repositories come from the global database module, so it is not imported
 * here. Exports exactly what the app module's controllers and providers inject
 * (ImportService, StatsService and the controllers); the rest stay internal.
 */
@Module({
  imports: [AuthModule],
  providers: [
    SeedService,
    TeamService,
    AnswerService,
    StandingsService,
    BonusService,
    FeedbackService,
    PlayerCountService,
    QuizService,
    ShowdownService,
    GameProgressRepository,
    SessionWrite,
    BlockGradingService,
    GameStateService,
    SessionBroadcaster,
    GameGateway,
    LiveEditService,
  ],
  exports: [
    GameStateService,
    GameGateway,
    SessionBroadcaster,
    LiveEditService,
    AnswerService,
    BonusService,
    TeamService,
    PlayerCountService,
    QuizService,
    SeedService,
    StandingsService,
  ],
})
export class GameModule {}
