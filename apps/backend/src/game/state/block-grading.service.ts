import type {
  GameProgress,
  QuestionType,
  ScoredQuestion,
} from '@campus-pubquiz/types';
import {
  isAutoGradedType,
  isBatchGradedType,
  isGradedStatus,
  isMatchOrHumanType,
  isBreakStatus,
} from '@campus-pubquiz/types';
import { AnswerService } from '@/answer/answer.service';
import { getBlockSeededQuestions } from '@/game/state/block-questions.util';
import { summarizeClosestGuess } from '@/game/state/closest-guess-reveal.util';
import type { SessionState } from '@/game/state/session-state';

/**
 * The one rule for which questions can ever count as "ungraded": closest_guess
 * is graded in a single batch once the question locks and can't be graded by
 * hand, so its answers never leave the admin anything to do. Shared by the
 * grading refresh and the reveal gate so they can't diverge.
 */
export function canBeUngraded(question: { type: QuestionType }): boolean {
  return !isBatchGradedType(question.type);
}

/**
 * What the grading refresh hands back for the caller to apply to the session
 * in one synchronous update: which of the questions whose grades just changed
 * are ungraded. Standings are not part of it — the session write reads them.
 */
interface GradingRefresh {
  questionIds: readonly number[];
  ungradedQuestionIds: readonly number[];
}

/** The apply half of the grading refresh: the refreshed questions' ungraded entries are replaced (added when ungraded, removed otherwise). The bulk refresh instead replaces the whole set outright. */
function applyGradingRefresh(
  session: SessionState,
  refresh: GradingRefresh,
): SessionState {
  const refreshed = new Set(refresh.questionIds);
  return {
    ...session,
    ungradedQuestionIds: [
      ...session.ungradedQuestionIds.filter((id) => !refreshed.has(id)),
      ...refresh.ungradedQuestionIds,
    ],
  };
}

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
    if (!isGradedStatus(newProgress.status)) return session;

    const blockQuestions = getBlockSeededQuestions({
      ...session,
      progress: newProgress,
    });
    const ungraded = blockQuestions.filter(
      (question) =>
        isBatchGradedType(question.type) &&
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

    // The batch scored these questions; closest_guess can never be ungraded,
    // so the refresh has nothing to change in the ungraded set.
    const refresh = await this.readGradingRefresh(
      { ...session, progress: newProgress },
      ungraded.map((question) => question.id),
    );
    return applyGradingRefresh(
      { ...session, closestGuessSummaries: summaries },
      refresh,
    );
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
   * the leaderboard afterward, same as ensureBlockGraded (both end through the grading refresh).
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

    return this.gradesChanged(session, [question.id]);
  }

  /**
   * Regrade for a key fix: re-grades already-shown questions after a live
   * edit changed their answer/points. `reloaded` is the session with its
   * quiz already re-read (that's where the corrected key is read from),
   * `before` is the session as it stood before the edit (the previous
   * questions are read from its seeded game) and `questionIds` are the
   * questions the save corrected. Returns the new session (closest_guess
   * summaries merged, ended through the grading refresh), the questions it
   * actually re-scored and the teams with an answer to one of them. With
   * nothing re-scored the session comes back unchanged.
   */
  async regradeForKeyFix(
    reloaded: SessionState,
    before: SessionState,
    questionIds: readonly number[],
  ): Promise<{
    session: SessionState;
    regradedQuestionIds: readonly number[];
    answeringTeamIds: ReadonlySet<number>;
  }> {
    const previousQuestions = new Map(
      before.seededGame.rounds
        .flatMap((round) => round.questions)
        .map((question) => [question.id, question] as const),
    );
    const { regradedQuestionIds, closestGuessSummaries } =
      await this.regradeQuestions(reloaded, questionIds, previousQuestions);
    if (regradedQuestionIds.length === 0) {
      return {
        session: reloaded,
        regradedQuestionIds,
        answeringTeamIds: new Set(),
      };
    }

    const session = await this.gradesChanged(
      {
        ...reloaded,
        closestGuessSummaries: {
          ...reloaded.closestGuessSummaries,
          ...closestGuessSummaries,
        },
      },
      regradedQuestionIds,
    );
    const answerLists = await Promise.all(
      regradedQuestionIds.map((questionId) =>
        this.answerService.listForQuestion(
          session.seededGame.gameSessionId,
          questionId,
        ),
      ),
    );
    return {
      session,
      regradedQuestionIds,
      answeringTeamIds: new Set(
        answerLists.flat().map((answer) => answer.teamId),
      ),
    };
  }

  /**
   * The per-type regrade behind regradeForKeyFix: auto-graded types re-score
   * every answer (kahoot questions re-apply speed scaling from the response
   * times stored at submit); match-or-human types grade new matches correct,
   * keep the moderator's grades and leave other non-matches ungraded;
   * closest_guess re-runs its batch only if it was already graded (otherwise
   * the normal lock flow grades it with the new key). A question missing from
   * `previousQuestions` is taken as unchanged. Only writes grades: names the
   * questions it re-scored and the closest_guess summaries it recomputed.
   */
  private async regradeQuestions(
    session: SessionState,
    questionIds: readonly number[],
    previousQuestions: ReadonlyMap<number, ScoredQuestion>,
  ): Promise<{
    regradedQuestionIds: readonly number[];
    closestGuessSummaries: SessionState['closestGuessSummaries'];
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

    let summaries: SessionState['closestGuessSummaries'] = {};
    const regradedQuestionIds: number[] = [];
    for (const { question, kahootTimerSeconds } of questions) {
      if (isAutoGradedType(question.type)) {
        await this.answerService.regradeAutoGraded(
          gameSessionId,
          question,
          kahootTimerSeconds,
        );
        regradedQuestionIds.push(question.id);
      } else if (isMatchOrHumanType(question.type)) {
        await this.answerService.regradeMatchOrHuman(
          gameSessionId,
          question,
          previousQuestions.get(question.id) ?? question,
        );
        regradedQuestionIds.push(question.id);
      } else if (
        isBatchGradedType(question.type) &&
        session.closestGuessSummaries[question.id] !== undefined
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
    return { regradedQuestionIds, closestGuessSummaries: summaries };
  }

  /**
   * Grades changed for `questionIds`: runs the grading refresh and returns the
   * session with those questions' ungraded entries replaced. Only questions in
   * the current block are refreshed. Reading and applying are one step; safe
   * because every grade change runs inside the session write.
   */
  async gradesChanged(
    session: SessionState,
    questionIds: readonly number[],
  ): Promise<SessionState> {
    return applyGradingRefresh(
      session,
      await this.readGradingRefresh(session, questionIds),
    );
  }

  /**
   * The read half of the grading refresh: which of the current block's
   * questions among `questionIds` are ungraded (through the one ungraded
   * reader, so closest_guess is still dropped). Questions outside the
   * current block are left alone: the cached set only ever describes the
   * block in play.
   */
  private async readGradingRefresh(
    session: SessionState,
    questionIds: readonly number[],
  ): Promise<GradingRefresh> {
    const blockQuestionIds = new Set(
      getBlockSeededQuestions(session).map((question) => question.id),
    );
    const refreshedIds = questionIds.filter((id) => blockQuestionIds.has(id));
    const ungradedQuestionIds = await this.listUngradedQuestionIds(session, [
      ...refreshedIds,
    ]);
    return { questionIds: refreshedIds, ungradedQuestionIds };
  }

  /**
   * The one reader for "which of these questions are ungraded": drops the
   * questions that can't be (closest_guess, via canBeUngraded) and asks the
   * database which of the rest have an answer with no grading time. Used by
   * the reveal gate and the grading refresh.
   */
  async listUngradedQuestionIds(
    session: SessionState,
    questionIds: number[],
  ): Promise<number[]> {
    const gradableIds = new Set(
      session.seededGame.rounds
        .flatMap((round) => round.questions)
        .filter(canBeUngraded)
        .map((question) => question.id),
    );
    return this.answerService.listUngradedQuestionIds(
      session.seededGame.gameSessionId,
      questionIds.filter((id) => gradableIds.has(id)),
    );
  }

  /** Current-block question IDs with at least one ungraded submitted answer, read fresh from the DB. */
  async getUngradedBlockQuestionIds(session: SessionState): Promise<number[]> {
    return this.listUngradedQuestionIds(
      session,
      getBlockSeededQuestions(session).map((question) => question.id),
    );
  }

  /**
   * Bulk-refreshes the block through the grading refresh (the ungraded set
   * from the DB) whenever the block just entered (or is still within) a break status — the authoritative
   * baseline the grading refresh in GameStateService.submitAnswer/gradeAnswer
   * build on between these recomputes. A no-op outside the break statuses,
   * since nothing there can be graded and the cached value can't go stale.
   */
  async refreshUngradedQuestionIds(
    session: SessionState,
    newProgress: GameProgress,
  ): Promise<SessionState> {
    if (!isBreakStatus(newProgress.status)) return session;
    const blockSession = { ...session, progress: newProgress };
    const refresh = await this.readGradingRefresh(
      blockSession,
      getBlockSeededQuestions(blockSession).map((question) => question.id),
    );
    // The refresh covers the whole block, so its set replaces the cached one
    // outright — nothing from an earlier block or a live edit survives.
    return {
      ...session,
      ungradedQuestionIds: [...refresh.ungradedQuestionIds],
    };
  }
}
