import { Injectable, Logger } from '@nestjs/common';
import {
  getSessionLiveEditFrontier,
  mergeLiveEditFrontiers,
  type ImportRoundPreview,
  type LiveEditFrontier,
  type QuizDraftSaveRequest,
  type QuizDraftSaveResult,
} from '@campus-pubquiz/types';
import { GameGateway } from '@/game/game.gateway';
import { GameStateService } from '@/game/state/game-state.service';
import type { SessionOutcome } from '@/game/state/session-outcome';
import {
  findLiveEditViolations,
  findRegradeQuestionIds,
  QuizLiveEditBlockedError,
} from '@/quiz/live-edit-guard';
import { QuizNotFoundError, QuizService } from '@/quiz/quiz.service';

/** How a save differs from the editor's plain one — a re-import sheet's. */
export interface LiveEditSaveStrategy {
  /**
   * The rounds the live-edit check compares with the stored ones: a sheet
   * carries no question ids, so each question is taken to be the stored one
   * at the same round and position.
   */
  identifyQuestions(
    stored: readonly ImportRoundPreview[],
    incoming: readonly ImportRoundPreview[],
  ): ImportRoundPreview[];
  /** Writes the rounds, in place of the editor's validating `QuizService.update`. */
  persist(rounds: ImportRoundPreview[]): Promise<QuizDraftSaveResult>;
}

export interface LiveEditSaveOptions {
  /**
   * A session that is not live (a re-import's lobby or ended session) whose
   * screens should also be sent the saved rounds, once the save has landed.
   */
  reloadJoinCode?: string;
  strategy?: LiveEditSaveStrategy;
}

interface PendingDelivery {
  joinCode: string;
  outcome: SessionOutcome;
}

/**
 * Saves a quiz's title and rounds while sessions may be playing it. With no
 * live session on the quiz it is a plain save. Otherwise the save is checked
 * and applied while every live session is held, so the game can't move past
 * the live-edit frontier the save was checked against: the save either lands
 * with each session still behind that frontier, or is refused.
 */
@Injectable()
export class LiveEditService {
  private readonly logger = new Logger(LiveEditService.name);

  constructor(
    private readonly quizService: QuizService,
    private readonly gameState: GameStateService,
    private readonly gameGateway: GameGateway,
  ) {}

  /** Whether any session is running (not lobby, not ended) on the quiz. */
  hasLiveSession(quizId: number): boolean {
    return this.gameState.listLiveSessions(quizId).length > 0;
  }

  /** The running sessions' frontiers merged, or null when none is running. */
  getFrontier(quizId: number): LiveEditFrontier | null {
    const sessions = this.gameState.listLiveSessions(quizId);
    if (sessions.length === 0) return null;
    return mergeLiveEditFrontiers(
      sessions.map((session) => getSessionLiveEditFrontier(session)),
    );
  }

  /**
   * Throws QuizLiveEditBlockedError (409) when a live session has reached
   * what the save would change, QuizDraftInvalidError (422) for a malformed
   * draft and QuizNotFoundError (404) for an unknown quiz.
   */
  async save(
    quizId: number,
    { title, rounds: requestedRounds }: QuizDraftSaveRequest,
    { reloadJoinCode, strategy }: LiveEditSaveOptions = {},
  ): Promise<QuizDraftSaveResult> {
    const deliveries: PendingDelivery[] = [];
    const persist = (rounds: ImportRoundPreview[]) =>
      strategy
        ? strategy.persist(rounds)
        : this.quizService.update(quizId, title, rounds);
    let result: QuizDraftSaveResult;
    try {
      result = await this.gameState.holdQuizSessions(quizId, async (held) => {
        const liveSessions = this.gameState.listLiveSessions(quizId);
        if (liveSessions.length === 0) return persist(requestedRounds);

        const currentDraft = await this.quizService.findDraftById(quizId);
        if (!currentDraft) throw new QuizNotFoundError(quizId);
        const rounds = strategy
          ? strategy.identifyQuestions(currentDraft.rounds, requestedRounds)
          : requestedRounds;
        const frontier = mergeLiveEditFrontiers(
          liveSessions.map((session) => getSessionLiveEditFrontier(session)),
        );
        const issues = findLiveEditViolations(
          currentDraft.rounds,
          rounds,
          frontier,
        );
        if (issues.length > 0) throw new QuizLiveEditBlockedError(issues);
        const regradeQuestionIds = findRegradeQuestionIds(
          currentDraft.rounds,
          rounds,
          frontier.openedQuestionIds,
        );

        const result = await persist(rounds);
        for (const { seededGame } of liveSessions) {
          deliveries.push({
            joinCode: seededGame.joinCode,
            outcome: await held.applyQuizEdit(
              seededGame.joinCode,
              regradeQuestionIds,
            ),
          });
        }
        return result;
      });
      if (
        reloadJoinCode !== undefined &&
        this.gameState.getActiveQuizId(reloadJoinCode) === quizId
      ) {
        deliveries.push({
          joinCode: reloadJoinCode,
          outcome: await this.gameState.quizEdited(reloadJoinCode),
        });
      }
    } catch (error) {
      // Sessions reloaded before the failure still need their broadcast, but
      // a delivery problem must not hide the error that failed the save.
      await this.deliverAll(deliveries, { swallowErrors: true });
      throw error;
    }
    await this.deliverAll(deliveries, { swallowErrors: false });
    return result;
  }

  /** After the hold is released, as with every session write. Every delivery is tried; the first failure is rethrown unless errors are swallowed (logged). */
  private async deliverAll(
    deliveries: readonly PendingDelivery[],
    { swallowErrors }: { swallowErrors: boolean },
  ): Promise<void> {
    const failures: unknown[] = [];
    for (const { joinCode, outcome } of deliveries) {
      try {
        await this.gameGateway.deliverSessionOutcome(joinCode, outcome);
      } catch (error) {
        this.logger.error(
          `Could not deliver the live-edit outcome to ${joinCode}`,
          error instanceof Error ? error.stack : String(error),
        );
        failures.push(error);
      }
    }
    if (!swallowErrors && failures.length > 0) throw failures[0];
  }
}
