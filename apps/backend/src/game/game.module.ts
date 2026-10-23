import { Module } from '@nestjs/common';
import { AnswerService } from '@/answer/answer.service';
import { AuthModule } from '@/auth/auth.module';
import { SeedService } from '@/db/seed.service';
import { BonusService } from '@/bonus/bonus.service';
import { EndedSessionsRead } from '@/ended-sessions-read/ended-sessions-read';
import { FeedbackService } from '@/feedback/feedback.service';
import { GameGateway } from '@/game/game.gateway';
import { LiveEditService } from '@/game/live-edit/live-edit.service';
import { LiveSessionRest } from '@/game/rest/live-session-rest.service';
import { SessionBroadcaster } from '@/game/socket/session-broadcaster';
import { BlockGradingService } from '@/game/state/block-grading.service';
import { GameProgressRepository } from '@/game/state/game-progress.repository';
import { GameStateService } from '@/game/state/game-state.service';
import { SessionWrite } from '@/game/state/session-write';
import { JokerService } from '@/joker/joker.service';
import { LeagueTableService } from '@/league/league-table.service';
import { LeagueService } from '@/league/league.service';
import { PlayerCountService } from '@/player-count/player-count.service';
import { QuizPreviewService } from '@/quiz/quiz-preview.service';
import { QuizService } from '@/quiz/quiz.service';
import { ShowdownService } from '@/showdown/showdown.service';
import { StandingsService } from '@/standings/standings.service';
import { TeamHistoryService } from '@/team/team-history.service';
import { TeamMergeService } from '@/team/team-merge.service';
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
    JokerService,
    SeedService,
    TeamService,
    TeamHistoryService,
    TeamMergeService,
    AnswerService,
    EndedSessionsRead,
    StandingsService,
    LeagueTableService,
    LeagueService,
    BonusService,
    FeedbackService,
    PlayerCountService,
    QuizService,
    QuizPreviewService,
    ShowdownService,
    GameProgressRepository,
    SessionWrite,
    BlockGradingService,
    GameStateService,
    SessionBroadcaster,
    GameGateway,
    LiveEditService,
    LiveSessionRest,
  ],
  exports: [
    GameStateService,
    GameGateway,
    SessionBroadcaster,
    LiveEditService,
    LiveSessionRest,
    AnswerService,
    BonusService,
    TeamService,
    TeamHistoryService,
    TeamMergeService,
    PlayerCountService,
    QuizService,
    QuizPreviewService,
    SeedService,
    EndedSessionsRead,
    StandingsService,
    LeagueTableService,
    LeagueService,
  ],
})
export class GameModule {}
