import {
  askTheRoomReady,
  coinBalance,
  describeJokerPickRounds,
  doubledRoundIds,
  findQuestionOpenForAnswering,
  getBlockInPlay,
  powerUpApplies,
  type DoubledRoundView,
  type SessionState,
  type OwnTeamView,
} from '@campus-pubquiz/types';
import type { AnswerService } from '@/answer/answer.service';
import type { BonusService } from '@/bonus/bonus.service';
import type { FeedbackService } from '@/feedback/feedback.service';
import type { PlayerCountService } from '@/player-count/player-count.service';
import {
  toPurchaseViews,
  type PurchaseService,
} from '@/purchase/purchase.service';

/**
 * The team view projection: everything one team's own phones may know about the
 * team, read from the database and the session. The one builder behind both the
 * join reply and the live team view event, so a rejoining phone and a connected
 * one can't disagree. Answers are the same list the join reply always carried
 * (already redacted by the answer service).
 */
export class TeamViewProjection {
  constructor(
    private readonly answers: Pick<
      AnswerService,
      'listForTeam' | 'listForQuestion'
    >,
    private readonly bonus: Pick<BonusService, 'listForTeam'>,
    private readonly feedback: Pick<
      FeedbackService,
      | 'listRoundRatingsForTeam'
      | 'getFeedbackForTeam'
      | 'getSessionRatingsForTeam'
    >,
    private readonly playerCounts: Pick<PlayerCountService, 'getForTeam'>,
    private readonly purchases: Pick<PurchaseService, 'listForTeam'>,
  ) {}

  /** The team view of each of `teamIds`, keyed by team id. Reads shared across teams (a question's answers) happen once. */
  async project(
    session: SessionState,
    teamIds: readonly number[],
  ): Promise<Map<number, OwnTeamView>> {
    const readyByTeam = await this.roomReadyByTeam(session, teamIds);
    const views = await Promise.all(
      teamIds.map(
        async (teamId) =>
          [
            teamId,
            await this.projectOne(session, teamId, readyByTeam.get(teamId)!),
          ] as const,
      ),
    );
    return new Map(views);
  }

  private async projectOne(
    session: SessionState,
    teamId: number,
    roomReadyQuestionIds: number[],
  ): Promise<OwnTeamView> {
    const { gameSessionId } = session.seededGame;
    const [
      answers,
      bonusAwards,
      roundRatings,
      feedback,
      sessionRatings,
      playerCount,
      purchases,
    ] = await Promise.all([
      this.answers.listForTeam(gameSessionId, teamId),
      this.bonus.listForTeam(gameSessionId, teamId),
      this.feedback.listRoundRatingsForTeam(gameSessionId, teamId),
      this.feedback.getFeedbackForTeam(gameSessionId, teamId),
      this.feedback.getSessionRatingsForTeam(gameSessionId, teamId),
      this.playerCounts.getForTeam(gameSessionId, teamId),
      this.purchases.listForTeam(gameSessionId, teamId),
    ]);
    const purchaseViews = toPurchaseViews(
      purchases,
      session.seededGame,
      session.progress.status,
    );
    return {
      answers,
      bonusAwards,
      roundRatings,
      feedback,
      sessionRatings,
      playerCount,
      joker: session.jokers[teamId] ?? null,
      sideId: session.teamSides[teamId] ?? null,
      coins: coinBalance(session, teamId, purchases),
      hasCarriedCoin: (session.carriedCoins[teamId] ?? 0) > 0,
      purchases: purchaseViews,
      roomReadyQuestionIds,
      doubledRounds: doubledRoundsOf(session, teamId, purchaseViews),
    };
  }

  /** For each team, the open questions on which its Ask the room is ready. Reads each question's answers once. */
  private async roomReadyByTeam(
    session: SessionState,
    teamIds: readonly number[],
  ): Promise<Map<number, number[]>> {
    const ready = new Map(teamIds.map((teamId) => [teamId, [] as number[]]));
    const { settings, gameSessionId, rounds } = session.seededGame;
    if (settings.powerUps.ask_the_room.maxUses <= 0) return ready;
    for (const { questionId } of getBlockInPlay(rounds, session.progress)) {
      const question = findQuestionOpenForAnswering(session, questionId);
      if (!question || !powerUpApplies('ask_the_room', question)) continue;
      const answers = await this.answers.listForQuestion(
        gameSessionId,
        questionId,
      );
      for (const teamId of teamIds) {
        if (askTheRoomReady(question, answers, teamId)) {
          ready.get(teamId)!.push(questionId);
        }
      }
    }
    return ready;
  }
}

/** The rounds that count double for a team, in quiz order, named by the joker pick's round list and the purchases. */
function doubledRoundsOf(
  session: SessionState,
  teamId: number,
  purchases: OwnTeamView['purchases'],
): DoubledRoundView[] {
  const doubled = doubledRoundIds(session.jokers[teamId]?.roundId, purchases);
  return describeJokerPickRounds(session, false)
    .filter(({ roundId }) => doubled.includes(roundId))
    .map(({ roundId, roundNumber, title }) => ({
      roundId,
      roundNumber,
      // A round bought blind keeps the purchase's "" title.
      title:
        purchases.find((purchase) => purchase.roundId === roundId)?.round
          ?.title ?? title,
    }));
}
