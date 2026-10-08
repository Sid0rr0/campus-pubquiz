import {
  type CreateShowdownRoundPayload,
  getTiedForFirst,
  isShowdownAcceptingGuesses,
  type SessionState,
  type SubmitShowdownGuessPayload,
} from '@campus-pubquiz/types';
import { SessionRefusal } from '@/game/state/errors/session-refusal.error';
import {
  BROADCAST_STATE_OUTCOME,
  type SessionOutcome,
} from '@/game/state/session-outcome';
import type { SessionChange } from '@/game/state/session-write';
import {
  withActiveShowdownRound,
  withShowdownGuess,
} from '@/game/state/session-updates.util';
import {
  InvalidShowdownError,
  ShowdownService,
} from '@/showdown/showdown.service';

/**
 * The showdowns change module: builds the changes for a team's showdown guess
 * and the quiz master starting a new showdown round. Composed inside the game
 * state class, which hands each builder to the Session write module. Owns the
 * translation of an invalid showdown error into a refusal, used by both.
 */
export class ShowdownsChanges {
  constructor(private readonly showdownService: ShowdownService) {}

  /**
   * A showdown guess from `socketId`. Checks, in order and before the guess is
   * stored: the showdown still accepts guesses, the socket owns the team's
   * seat, the team takes part. Checked against the session the write holds, so
   * a guess sent as the reveal starts is either counted by the resolve or
   * refused. The latest guess replaces any earlier one.
   */
  async guess(
    session: SessionState,
    { showdownRoundId, teamId, value }: SubmitShowdownGuessPayload,
    socketId: string,
  ): Promise<SessionChange<SessionOutcome>> {
    const round = session.activeShowdownRound;
    if (
      !isShowdownAcceptingGuesses(
        round,
        showdownRoundId,
        session.showdownRevealStep,
      )
    ) {
      throw new SessionRefusal(
        'This showdown round is no longer accepting guesses',
      );
    }
    if (session.connectedTeamSockets[teamId] !== socketId) {
      throw new SessionRefusal('You may only submit guesses for your own team');
    }
    if (!round?.participants.some((entry) => entry.teamId === teamId)) {
      throw new SessionRefusal('Your team is not part of this showdown round');
    }

    await this.refusingInvalidShowdown(() =>
      this.showdownService.submitGuess(showdownRoundId, teamId, value),
    );
    return {
      session: withShowdownGuess(session, teamId, value),
      outcome: BROADCAST_STATE_OUTCOME,
    };
  }

  /**
   * Starts a showdown round for the teams tied for first, in leaderboard
   * (seat) order. The tie is read from the leaderboard of the session the
   * write holds, so a round is only created for teams still tied. Leaves
   * isLeaderboardVisible alone: the admin's own Hide Leaderboard press clears
   * it before the reveal starts, and forcing it here would yank the final
   * standings off the display the moment the tiebreaker question is saved.
   */
  async newRound(
    session: SessionState,
    { question, answer, points }: CreateShowdownRoundPayload,
  ): Promise<SessionChange<SessionOutcome>> {
    const tied = getTiedForFirst(session.leaderboard);
    if (tied.length < 2) {
      throw new SessionRefusal('No tie for first place to break');
    }

    const round = await this.refusingInvalidShowdown(() =>
      this.showdownService.createRound(
        session.seededGame.gameSessionId,
        tied.map(({ teamId, teamName }) => ({ teamId, teamName })),
        question,
        answer,
        points,
      ),
    );
    return {
      session: withActiveShowdownRound(session, round),
      outcome: BROADCAST_STATE_OUTCOME,
    };
  }

  /** Runs a showdown service call, turning its domain error into the refusal a team or the admin sees. */
  private async refusingInvalidShowdown<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      if (error instanceof InvalidShowdownError) {
        throw new SessionRefusal(error.message);
      }
      throw error;
    }
  }
}
