import type { GameProgress, GameStatus } from '@campus-pubquiz/types';
import { isAutoGradedType } from '@campus-pubquiz/types';
import { AnswerService } from '@/answer/answer.service';
import { StandingsService } from '@/standings/standings.service';
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
 * The one rule for which questions can ever count as "ungraded": closest_guess
 * is graded in a single batch once the question locks and can't be graded by
 * hand, so its answers never leave the admin anything to do. Shared by the
 * per-question incremental update and the bulk refresh so they can't diverge.
 */
export function canBeUngraded(question: { type: string }): boolean {
  return question.type !== 'closest_guess';
}

/**
 * Grading side-effects that fire during applyAction's status transitions —
 * auto-grading closest_guess questions and keeping the ungraded-answer cache
 * fresh. Split out of GameStateService since neither participates in the
 * state machine itself, only in what happens around it.
 */
export class BlockGradingService {
  constructor(
    private readonly answerService: AnswerService,
    private readonly standingsService: StandingsService,
  ) {}

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
        question,
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
    const leaderboard = await this.standingsService.leaderboard(
      session.seededGame.gameSessionId,
    );
    return { ...session, closestGuessSummaries: summaries, leaderboard };
  }

  /**
   * Rescales the just-locked question's points by answer speed, but only
   * when leaving 'locking' for a kahootMode round — covers both the
   * collapsed locking->reveal path and the ordinary locking->break_intro
   * path (irrelevant there since a kahootMode round never takes it, but
   * cheap to check generically). The scoring reads each answer's response
   * time as stored at submit, so a redundant re-run (e.g. PREVIOUS from
   * 'reveal' back into 'locking' followed by another ADVANCE) recomputes the
   * same points — the status transition is the only guard needed. Recomputes
   * the leaderboard afterward, same as ensureBlockGraded.
   */
  async ensureKahootSpeedScored(
    session: SessionState,
    newProgress: GameProgress,
  ): Promise<SessionState> {
    if (
      session.progress.status !== 'locking' ||
      newProgress.status === 'locking'
    ) {
      return session;
    }
    const round = session.seededGame.rounds[session.progress.roundIndex];
    if (!round?.kahootMode) return session;

    const question = round.questions[session.progress.questionIndex];
    await this.answerService.applyKahootSpeedScoring(
      session.seededGame.gameSessionId,
      question,
      session.seededGame.settings.kahootQuestionTimerSeconds,
    );

    const leaderboard = await this.standingsService.leaderboard(
      session.seededGame.gameSessionId,
    );
    return { ...session, leaderboard };
  }

  /**
   * Re-grades already-shown questions after a live edit changed their
   * answer/points — `session.seededGame` must already be reloaded, since
   * that's where the corrected key is read from. Auto-graded types re-score
   * every answer (kahoot questions re-apply speed scaling from the response
   * times stored at submit);
   * closest_guess re-runs its batch only if it was already graded (otherwise
   * the normal lock flow grades it with the new key); human-graded types keep
   * the admin's judgement. Recomputes the leaderboard if anything changed,
   * and names the questions it re-scored.
   */
  async regradeQuestions(
    session: SessionState,
    questionIds: readonly number[],
  ): Promise<{
    session: SessionState;
    regradedQuestionIds: readonly number[];
  }> {
    const { gameSessionId } = session.seededGame;
    const { kahootQuestionTimerSeconds } = session.seededGame.settings;
    const questions = session.seededGame.rounds
      .flatMap((round) =>
        round.questions.map((question) => ({
          question,
          kahootTimerSeconds:
            round.kahootMode === true ? kahootQuestionTimerSeconds : null,
        })),
      )
      .filter(({ question }) => questionIds.includes(question.id));

    let summaries = session.closestGuessSummaries;
    const regradedQuestionIds: number[] = [];
    for (const { question, kahootTimerSeconds } of questions) {
      if (isAutoGradedType(question.type)) {
        await this.answerService.regradeAutoGraded(
          gameSessionId,
          question,
          kahootTimerSeconds,
        );
        regradedQuestionIds.push(question.id);
      } else if (
        question.type === 'closest_guess' &&
        summaries[question.id] !== undefined
      ) {
        const graded = await this.answerService.gradeClosestGuess(
          gameSessionId,
          question,
        );
        summaries = {
          ...summaries,
          [question.id]: summarizeClosestGuess(graded),
        };
        regradedQuestionIds.push(question.id);
      }
    }
    if (regradedQuestionIds.length === 0) {
      return { session, regradedQuestionIds };
    }

    const leaderboard = await this.standingsService.leaderboard(gameSessionId);
    return {
      session: { ...session, closestGuessSummaries: summaries, leaderboard },
      regradedQuestionIds,
    };
  }

  /** Current-block question IDs (closest_guess excluded) with at least one ungraded submitted answer, read fresh from the DB. */
  async getUngradedBlockQuestionIds(session: SessionState): Promise<number[]> {
    const questionIds = getBlockSeededQuestions(session)
      .filter(canBeUngraded)
      .map((question) => question.id);
    return this.answerService.listUngradedQuestionIds(
      session.seededGame.gameSessionId,
      questionIds,
    );
  }

  /**
   * Bulk-recomputes ungradedQuestionIds from the DB whenever the block just
   * entered (or is still within) a grading status — the authoritative
   * baseline the per-question refresh in GameStateService.recordAnswer/answerGraded
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
