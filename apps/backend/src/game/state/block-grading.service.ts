import type { GameProgress, GameStatus } from '@campus-pubquiz/types';
import { AnswerService } from '@/answer/answer.service';
import { getBlockSeededQuestions } from '@/game/state/block-questions.util';
import { summarizeClosestGuess } from '@/game/state/closest-guess-reveal.util';
import type { SessionState } from '@/game/state/session-state';

/** Statuses in which the break/grading screens are actively reviewing the just-locked block — the window where ungradedQuestionIds is kept fresh. */
const GRADING_STATUSES: GameStatus[] = [
  'break_intro',
  'break',
  'break_round_intro',
];

const GRADED_STATUSES: GameStatus[] = [
  'break_intro',
  'break',
  'break_round_intro',
  'reveal_intro',
  'reveal',
  'ended',
];

/**
 * Grading side-effects that fire during applyAction's status transitions —
 * auto-grading closest_guess questions and keeping the ungraded-answer cache
 * fresh. Split out of GameStateService since neither participates in the
 * state machine itself, only in what happens around it.
 */
export class BlockGradingService {
  constructor(private readonly answerService: AnswerService) {}

  /** Batch-grades every closest_guess question in the block once it reaches a graded status, caching the result — safe to call every applyAction since it skips questions already in closestGuessSummaries. */
  async ensureBlockGraded(
    session: SessionState,
    newProgress: GameProgress,
  ): Promise<SessionState> {
    if (!GRADED_STATUSES.includes(newProgress.status)) return session;

    const blockQuestions = getBlockSeededQuestions({
      ...session,
      progress: newProgress,
    });
    const ungraded = blockQuestions.filter(
      (question) =>
        question.type === 'closest_guess' &&
        session.closestGuessSummaries[question.id] === undefined,
    );
    if (ungraded.length === 0) return session;

    let summaries = session.closestGuessSummaries;
    for (const question of ungraded) {
      const graded = await this.answerService.gradeClosestGuess(
        session.seededGame.gameSessionId,
        question.id,
        question.answer,
        question.points,
      );
      summaries = {
        ...summaries,
        [question.id]: summarizeClosestGuess(graded),
      };
    }

    // closest_guess questions are graded automatically right here rather
    // than through GRADE_ANSWER/AWARD_BONUS (the only other two places that
    // refresh session.leaderboard) — without this, the points just written
    // above wouldn't show up in the team table until the next explicit grade
    // or a leaderboard toggle.
    const leaderboard = await this.answerService.computeLeaderboard(
      session.seededGame.gameSessionId,
    );
    return { ...session, closestGuessSummaries: summaries, leaderboard };
  }

  /** Current-block question IDs (closest_guess excluded) with at least one ungraded submitted answer, read fresh from the DB. */
  async getUngradedBlockQuestionIds(session: SessionState): Promise<number[]> {
    const questionIds = getBlockSeededQuestions(session)
      .filter((question) => question.type !== 'closest_guess')
      .map((question) => question.id);
    return this.answerService.listUngradedQuestionIds(
      session.seededGame.gameSessionId,
      questionIds,
    );
  }

  /**
   * Bulk-recomputes ungradedQuestionIds from the DB whenever the block just
   * entered (or is still within) a grading status — the authoritative
   * baseline the gateway's per-question setQuestionGradedStatus patches
   * build on between these recomputes. A no-op outside GRADING_STATUSES,
   * since nothing there can be graded and the cached value can't go stale.
   */
  async refreshUngradedQuestionIds(
    session: SessionState,
    newProgress: GameProgress,
  ): Promise<SessionState> {
    if (!GRADING_STATUSES.includes(newProgress.status)) return session;
    const ungradedQuestionIds = await this.getUngradedBlockQuestionIds({
      ...session,
      progress: newProgress,
    });
    return { ...session, ungradedQuestionIds };
  }
}
