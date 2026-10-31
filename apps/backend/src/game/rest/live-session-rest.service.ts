import { Injectable } from '@nestjs/common';
import type {
  AnswersUpdatedPayload,
  BonusAwardAdminView,
  BonusAwardsListedPayload,
  SessionSettings,
} from '@campus-pubquiz/types';
import { AnswerService } from '@/answer/answer.service';
import {
  BonusAwardNotFoundError,
  BonusService,
  InvalidBonusAwardError,
} from '@/bonus/bonus.service';
import { SessionBroadcaster } from '@/game/socket/session-broadcaster';
import { BonusAwardNotFoundRefusal } from '@/game/state/errors/bonus-award-not-found-refusal.error';
import { InvalidBonusAwardRefusal } from '@/game/state/errors/invalid-bonus-award-refusal.error';
import { UnknownLiveSessionError } from '@/game/state/errors/unknown-live-session.error';
import { GameStateService } from '@/game/state/game-state.service';

export { UnknownLiveSessionError } from '@/game/state/errors/unknown-live-session.error';

/** A parsed settings patch: the lobby settings to merge and the leagues to replace (undefined leaves them). */
export interface SettingsAndLeaguesUpdate {
  partial: Partial<SessionSettings>;
  leagueIds: number[] | undefined;
}

/** Turns the session refusals a bonus change throws back into the bonus service's error types, which the controllers map to 400 / 404. */
async function asBonusErrors<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof BonusAwardNotFoundRefusal) {
      throw new BonusAwardNotFoundError(error.message);
    }
    if (error instanceof InvalidBonusAwardRefusal) {
      throw new InvalidBonusAwardError(error.message);
    }
    throw error;
  }
}

/**
 * The REST entry to the Live session module: the counterpart of the gateway for
 * HTTP. Each REST route makes one call here. A change runs through the game
 * state service, then its outcome goes to the broadcaster's delivery step.
 *
 * It stays thin: rules belong in the change modules, pushes in delivery, and
 * mapping errors to HTTP status codes in the controllers. A join code with no
 * live session, whether missing up front or closed while the request waited in
 * the queue, is an UnknownLiveSessionError from every method.
 */
@Injectable()
export class LiveSessionRest {
  constructor(
    private readonly gameState: GameStateService,
    private readonly broadcaster: SessionBroadcaster,
    private readonly bonusService: BonusService,
    private readonly answerService: AnswerService,
  ) {}

  /** The admin view of a team's bonus awards in the session. */
  listBonusAwards(
    joinCode: string,
    teamId: number,
  ): Promise<BonusAwardsListedPayload> {
    return this.inLiveSession(joinCode, async () => ({
      teamId,
      awards: await this.bonusService.listForTeamAdmin(
        this.gameState.getGameSessionId(joinCode),
        teamId,
      ),
    }));
  }

  /** Edits an award's points and reason inside the Session write, then delivers the outcome. A refusal surfaces as the bonus service's own error type and message. */
  editBonus(
    joinCode: string,
    awardId: number,
    points: number,
    reason: string | undefined,
  ): Promise<BonusAwardAdminView> {
    return this.inLiveSession(joinCode, async () => {
      const { outcome, award } = await asBonusErrors(() =>
        this.gameState.editBonus(joinCode, awardId, points, reason),
      );
      await this.broadcaster.deliver(joinCode, outcome);
      return award;
    });
  }

  /** Removes an award inside the Session write, then delivers the outcome. */
  removeBonus(joinCode: string, awardId: number): Promise<void> {
    return this.inLiveSession(joinCode, async () => {
      const outcome = await asBonusErrors(() =>
        this.gameState.removeBonus(joinCode, awardId),
      );
      await this.broadcaster.deliver(joinCode, outcome);
    });
  }

  /** A question's answers with its admin question context, or null when the quiz has no such question. */
  listAnswers(
    joinCode: string,
    questionId: number,
  ): Promise<AnswersUpdatedPayload | null> {
    return this.inLiveSession(joinCode, async () => {
      const question = this.gameState.getAdminQuestionContext(
        joinCode,
        questionId,
      );
      if (!question) return null;
      const answers = await this.answerService.listForQuestion(
        this.gameState.getGameSessionId(joinCode),
        questionId,
      );
      return { questionId, question, answers };
    });
  }

  /**
   * Merges lobby settings and/or replaces the session's leagues, then redraws
   * its clients. `parseRequest` reads the request body and runs only once the
   * session is known to be live, so an unknown join code answers as unknown
   * before a bad body answers as invalid.
   */
  updateSettingsAndLeagues(
    joinCode: string,
    parseRequest: () => SettingsAndLeaguesUpdate,
  ): Promise<void> {
    return this.inLiveSession(joinCode, async () => {
      const { partial, leagueIds } = parseRequest();
      await this.broadcaster.deliver(
        joinCode,
        await this.gameState.updateSessionSettings(
          joinCode,
          partial,
          leagueIds,
        ),
      );
    });
  }

  /** Closes an ended session, then tells its phones the session closed. */
  async closeSession(joinCode: string): Promise<void> {
    await this.inLiveSession(joinCode, () =>
      this.gameState.closeSession(joinCode),
    );
    this.broadcaster.notifySessionClosed(joinCode);
  }

  /** Re-reads each live session's league top after a league write and redraws the lobbies whose league top changed. */
  refreshLeagueLobbies(): Promise<void> {
    return this.broadcaster.refreshLeagueLobbies();
  }

  /** Runs `run` for a live session; a session missing up front, or closed while `run` waited its turn, is an UnknownLiveSessionError. */
  private async inLiveSession<T>(
    joinCode: string,
    run: () => Promise<T>,
  ): Promise<T> {
    if (!this.gameState.hasSession(joinCode)) {
      throw new UnknownLiveSessionError(joinCode);
    }
    try {
      return await run();
    } catch (error) {
      if (!this.gameState.hasSession(joinCode)) {
        throw new UnknownLiveSessionError(joinCode);
      }
      throw error;
    }
  }
}
