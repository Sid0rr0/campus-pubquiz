import { Injectable } from '@nestjs/common';
import {
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

export interface LiveEditSaveOptions {
  /**
   * A session that is not live (a re-import's lobby or ended session) whose
   * screens should also be sent the saved rounds, once the save has landed.
   */
  reloadJoinCode?: string;
  /**
   * The rounds carry no question ids (a re-import sheet): each question is
   * the stored question at the same round and position, as the plain save
   * of a sheet treats it, so the live-edit check compares like with like.
   */
  identifyQuestionsBySlot?: boolean;
}

function withQuestionIdsBySlot(
  stored: readonly ImportRoundPreview[],
  incoming: readonly ImportRoundPreview[],
): ImportRoundPreview[] {
  return incoming.map((round, roundIndex) => ({
    ...round,
    questions: round.questions.map((question, questionIndex) => {
      const questionId =
        stored[roundIndex]?.questions[questionIndex]?.questionId;
      return questionId === undefined ? question : { ...question, questionId };
    }),
  }));
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
      sessions.map((session) => this.gameState.getLiveEditFrontier(session)),
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
    { reloadJoinCode, identifyQuestionsBySlot }: LiveEditSaveOptions = {},
  ): Promise<QuizDraftSaveResult> {
    const deliveries: PendingDelivery[] = [];
    try {
      const result = await this.gameState.holdQuizSessions(quizId, async () => {
        const liveSessions = this.gameState.listLiveSessions(quizId);
        if (liveSessions.length === 0) {
          return this.quizService.update(quizId, title, requestedRounds);
        }

        const currentDraft = await this.quizService.findDraftById(quizId);
        if (!currentDraft) throw new QuizNotFoundError(quizId);
        const rounds = identifyQuestionsBySlot
          ? withQuestionIdsBySlot(currentDraft.rounds, requestedRounds)
          : requestedRounds;
        const frontier = mergeLiveEditFrontiers(
          liveSessions.map((session) =>
            this.gameState.getLiveEditFrontier(session),
          ),
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

        const result = await this.quizService.update(quizId, title, rounds);
        for (const { seededGame } of liveSessions) {
          deliveries.push({
            joinCode: seededGame.joinCode,
            outcome: await this.gameState.applyQuizEdit(
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
      return result;
    } finally {
      // After the hold is released, as with every session write. Sessions
      // reloaded before a failure still need their broadcast.
      for (const { joinCode, outcome } of deliveries) {
        await this.gameGateway.deliverSessionOutcome(joinCode, outcome);
      }
    }
  }
}
