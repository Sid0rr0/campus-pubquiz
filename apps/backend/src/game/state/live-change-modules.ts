import { Inject, Injectable, Optional } from '@nestjs/common';
import { AnswerService } from '@/answer/answer.service';
import { BonusService } from '@/bonus/bonus.service';
import { CarriedCoinService } from '@/coins/carried-coin.service';
import { FeedbackService } from '@/feedback/feedback.service';
import { JokerService } from '@/joker/joker.service';
import { LeagueTableService } from '@/league/league-table.service';
import { LeagueService } from '@/league/league.service';
import { PlayerCountService } from '@/player-count/player-count.service';
import { PurchaseService } from '@/purchase/purchase.service';
import { ShowdownService } from '@/showdown/showdown.service';
import { StandingsService } from '@/standings/standings.service';
import { SeedService } from '@/db/seed.service';
import { TeamService } from '@/team/team.service';
import { AnswersChanges } from '@/game/state/answers-changes';
import { BlockGradingService } from '@/game/state/block-grading.service';
import { BonusAwardsChanges } from '@/game/state/bonus-awards-changes';
import { MoveCommitter } from '@/game/state/commit-a-move.service';
import { GameProgressRepository } from '@/game/state/game-progress.repository';
import {
  JOKER_RANDOM,
  JokerChanges,
  type RandomSource,
} from '@/game/state/joker-changes';
import { LeagueChanges } from '@/game/state/league-changes';
import { PurchaseChanges } from '@/game/state/purchase-changes';
import { SessionSettingsChanges } from '@/game/state/session-settings-changes';
import { SessionWrite } from '@/game/state/session-write';
import { ShowdownsChanges } from '@/game/state/showdowns-changes';
import { TeamFeedbackChanges } from '@/game/state/team-feedback-changes';
import { TeamPlayerCountChanges } from '@/game/state/team-player-count-changes';
import { TeamRosterChanges } from '@/game/state/team-roster-changes';
import { TeamSideChanges } from '@/game/state/team-side-changes';
import { TeamViewProjection } from '@/game/state/team-view-projection';
import { TimerExpiryChanges } from '@/game/state/timer-expiry-changes';

/**
 * The live session change modules and the move pipeline, built once from the
 * injected stores and the joker random source. The one place their
 * dependencies are wired.
 */
@Injectable()
export class LiveChangeModules {
  readonly purchase: PurchaseChanges;
  readonly joker: JokerChanges;
  readonly settings: SessionSettingsChanges;
  readonly side: TeamSideChanges;
  readonly answers: AnswersChanges;
  readonly bonus: BonusAwardsChanges;
  readonly roster: TeamRosterChanges;
  readonly teamViews: TeamViewProjection;
  readonly feedback: TeamFeedbackChanges;
  readonly playerCount: TeamPlayerCountChanges;
  readonly showdowns: ShowdownsChanges;
  readonly league: LeagueChanges;
  readonly moveCommitter: MoveCommitter;
  readonly timerExpiry: TimerExpiryChanges;

  constructor(
    progressRepository: GameProgressRepository,
    seedService: SeedService,
    answerService: AnswerService,
    standingsService: StandingsService,
    showdownService: ShowdownService,
    teamService: TeamService,
    bonusService: BonusService,
    feedbackService: FeedbackService,
    playerCountService: PlayerCountService,
    sessionWrite: SessionWrite,
    grading: BlockGradingService,
    leagueTableService: LeagueTableService,
    leagueService: LeagueService,
    jokerService: JokerService,
    carriedCoinService: CarriedCoinService,
    purchaseService: PurchaseService,
    @Optional() @Inject(JOKER_RANDOM) random?: RandomSource,
  ) {
    this.purchase = new PurchaseChanges(
      purchaseService,
      random ?? Math.random,
      answerService,
    );
    this.joker = new JokerChanges(
      jokerService,
      teamService,
      purchaseService,
      random ?? Math.random,
    );
    this.settings = new SessionSettingsChanges(seedService, teamService);
    this.side = new TeamSideChanges(teamService);
    this.answers = new AnswersChanges(answerService, grading);
    this.bonus = new BonusAwardsChanges(bonusService);
    this.roster = new TeamRosterChanges(
      teamService,
      playerCountService,
      this.joker,
      carriedCoinService,
    );
    this.teamViews = new TeamViewProjection(
      answerService,
      bonusService,
      feedbackService,
      playerCountService,
      purchaseService,
    );
    this.feedback = new TeamFeedbackChanges(feedbackService);
    this.playerCount = new TeamPlayerCountChanges(
      playerCountService,
      standingsService,
    );
    this.showdowns = new ShowdownsChanges(showdownService);
    this.league = new LeagueChanges(
      leagueService,
      leagueTableService,
      this.settings,
    );
    this.moveCommitter = new MoveCommitter(
      grading,
      progressRepository,
      sessionWrite.liveResultsRead,
      showdownService,
      (gameSessionId) => this.league.topOrNull(gameSessionId),
      this.joker,
      carriedCoinService,
      (gameSessionId) => bonusService.coinAwardTotals(gameSessionId),
      (gameSessionId) => teamService.listSides(gameSessionId),
    );
    this.timerExpiry = new TimerExpiryChanges(this.moveCommitter);
  }
}
