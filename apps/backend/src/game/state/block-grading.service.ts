import { Injectable } from '@nestjs/common';
import {
  type GameProgress,
  isBreakStatus,
  isGradedStatus,
  type ScoredQuestion,
  type SessionState,
  summarizeClosestGuess,
  getBlockInPlay,
  getBlockInPlayIds,
} from '@campus-pubquiz/types';
import { AnswerService } from '@/answer/answer.service';
import { UngradedAnswersError } from '@/game/state/errors/ungraded-answers.error';
import { canBeUngraded, gradesAtLock } from '@/answer/grading-policy';

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
@Injectable()
export class BlockGradingService {
  constructor(private readonly answerService: AnswerService) {}

  /**
   * Grades what a move implies. `session` is the session as it stood before
   * the press (its progress is where the move starts), `toProgress` the
   * progress the move leads to. The steps run in this order, because each reads what the
   * one before wrote:
   *   1. the reveal gate — refuses leaving a break for the reveal while any
   *      question in the block is ungraded; runs before any grading write, so
   *      a refused move writes nothing
   *   2. the kahoot speed scoring, when a kahoot question leaves 'locking'
   *   3. the closest_guess batch, when `toProgress` is a graded status
   *   4. the whole-block grading refresh, when `toProgress` is a break status
   * Returns the graded session and the questions whose admin answer list is
   * now stale.
   */
  async gradeForMove(
    session: SessionState,
    toProgress: GameProgress,
  ): Promise<{ session: SessionState; staleAnswerListIds: number[] }> {
    await this.assertNothingUngradedLeavingBreak(session, toProgress);
    const speedScored = await this.ensureKahootSpeedScored(session, toProgress);
    const { session: graded, staleAnswerListIds } =
      await this.ensureBlockGraded(speedScored, toProgress);
    return {
      session: await this.refreshUngradedQuestionIds(graded, toProgress),
      staleAnswerListIds,
    };
  }

  /**
   * Grades a session placed at `progress` (creation, or restart restore): the
   * closest_guess batch, which only rebuilds summaries here and never
   * re-scores a question already graded, then the whole-block refresh. The
   * stale answer lists the batch reports are dropped on purpose: no socket is
   * connected during placement, and /control reads its answer list fresh when
   * it connects.
   */
  async gradeForPlacement(
    session: SessionState,
    progress: GameProgress,
  ): Promise<SessionState> {
    const { session: summarized } = await this.ensureBlockGraded(
      session,
      progress,
    );
    return this.refreshUngradedQuestionIds(summarized, progress);
  }

  /**
   * The reveal gate, step 1 of gradeForMove: leaving the break/grading screens for the reveal is the
   * one moment the ungraded set must be DB-authoritative rather than the
   * (possibly stale, e.g. post-restart) cached set.
   */
  private async assertNothingUngradedLeavingBreak(
    session: SessionState,
    toProgress: GameProgress,
  ): Promise<void> {
    const { status } = session.progress;
    const isLeavingBreak = status === 'break_intro' || status === 'break';
    if (!isLeavingBreak || toProgress.status !== 'reveal_intro') return;

    const ungradedQuestionIds = await this.getUngradedBlockQuestionIds(session);
    if (ungradedQuestionIds.length > 0) {
      throw new UngradedAnswersError(ungradedQuestionIds);
    }
  }

  /**
   * Step 3 of gradeForMove (also run by gradeForPlacement). Batch-grades every
   * closest_guess question in the block once it reaches a
   * graded status, caching its reveal summary — safe to call every move since
   * it skips questions already in closestGuessSummaries, and after a restart
   * (summaries are in memory only) it rebuilds a summary from the stored
   * grades without re-scoring them. Returns the session and the questions
   * whose admin answer list may now be out of date (graded just now, or
   * summarized after a restart).
   */
  private async ensureBlockGraded(
    session: SessionState,
    newProgress: GameProgress,
  ): Promise<{ session: SessionState; staleAnswerListIds: number[] }> {
    if (!isGradedStatus(newProgress.status)) {
      return { session, staleAnswerListIds: [] };
    }

    const blockQuestions = getBlockInPlay(
      session.seededGame.rounds,
      newProgress,
    ).map(
      ({ roundIndex, questionIndex }) =>
        session.seededGame.rounds[roundIndex].questions[questionIndex],
    );
    const unsummarized = blockQuestions.filter(
      (question) =>
        gradesAtLock(question) &&
        session.closestGuessSummaries[question.id] === undefined,
    );
    if (unsummarized.length === 0) return { session, staleAnswerListIds: [] };

    let summaries = session.closestGuessSummaries;
    for (const question of unsummarized) {
      const graded = await this.answerService.gradeAtLock(
        session.seededGame.gameSessionId,
        question,
      );
      summaries = {
        ...summaries,
        [question.id]: summarizeClosestGuess(question.answer, graded),
      };
    }

    // closest_guess can never be ungraded, so the refresh has nothing to
    // change in the ungraded set whether the batch ran just now or before.
    const staleAnswerListIds = unsummarized.map((question) => question.id);
    const refresh = await this.readGradingRefresh(
      session,
      newProgress,
      staleAnswerListIds,
    );
    return {
      session: applyGradingRefresh(
        { ...session, closestGuessSummaries: summaries },
        refresh,
      ),
      staleAnswerListIds,
    };
  }

  /**
   * Rescales the just-locked question's points by answer speed, but only
   * when leaving 'locking' for a kahootMode round — covers both the
   * collapsed locking->reveal path and the ordinary locking->break_intro
   * path (irrelevant there since a kahootMode round never takes it, but
   * cheap to check generically). Step 2 of gradeForMove, not called from
   * outside. The scoring reads each answer's response
   * time as stored at submit, so a redundant re-run (e.g. PREVIOUS from
   * 'reveal' back into 'locking' followed by another ADVANCE) recomputes the
   * same points — the status transition is the only guard needed. Refreshes the
   * ungraded entry for the scored question through the grading refresh, like
   * the other steps; the leaderboard is read afterward by the session write.
   */
  private async ensureKahootSpeedScored(
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
    await this.answerService.speedScoreAtLock(
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
   * The regrade behind regradeForKeyFix: one call per corrected question,
   * the Grading policy deciding what each grading mode does (see the answer
   * module's regradeForKeyFix). "Has the batch run" is whether the session
   * holds the question's closest_guess summary; when it does, the summary is
   * recomputed from the returned answers. A question missing from
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
    const { gameSessionId, settings } = session.seededGame;
    const questions = session.seededGame.rounds
      .flatMap((round) =>
        round.questions.map((question) => ({
          question,
          kahootTimerSeconds: round.kahootMode
            ? settings.kahootQuestionTimerSeconds
            : null,
        })),
      )
      .filter(({ question }) => questionIds.includes(question.id));

    let summaries: SessionState['closestGuessSummaries'] = {};
    const regradedQuestionIds: number[] = [];
    for (const { question, kahootTimerSeconds } of questions) {
      const hasBatchRun =
        session.closestGuessSummaries[question.id] !== undefined;
      const { rescored, answers } = await this.answerService.regradeForKeyFix(
        gameSessionId,
        question,
        previousQuestions.get(question.id) ?? question,
        kahootTimerSeconds,
        hasBatchRun,
      );
      if (!rescored) continue;
      regradedQuestionIds.push(question.id);
      if (hasBatchRun) {
        summaries = {
          ...summaries,
          [question.id]: summarizeClosestGuess(question.answer, answers),
        };
      }
    }
    return { regradedQuestionIds, closestGuessSummaries: summaries };
  }

  /**
   * Grades changed for `questionIds`: runs the grading refresh and returns the
   * session with those questions' ungraded entries replaced. Only questions in
   * the block in play are refreshed. Reading and applying are one step; safe
   * because every grade change runs inside the session write.
   */
  async gradesChanged(
    session: SessionState,
    questionIds: readonly number[],
  ): Promise<SessionState> {
    return applyGradingRefresh(
      session,
      await this.readGradingRefresh(session, session.progress, questionIds),
    );
  }

  /**
   * The read half of the grading refresh: which of the current block's
   * questions among `questionIds` are ungraded (through the one ungraded
   * reader, so closest_guess is still dropped). Questions outside the block
   * in play for `progress` are left alone: the cached set only ever
   * describes the block in play.
   */
  private async readGradingRefresh(
    session: SessionState,
    progress: GameProgress,
    questionIds: readonly number[],
  ): Promise<GradingRefresh> {
    const blockQuestionIds = new Set(
      getBlockInPlayIds(session.seededGame.rounds, progress),
    );
    const refreshedIds = questionIds.filter((id) => blockQuestionIds.has(id));
    const ungradedQuestionIds = await this.listUngradedQuestionIds(session, [
      ...refreshedIds,
    ]);
    return { questionIds: refreshedIds, ungradedQuestionIds };
  }

  /**
   * The one reader for "which of these questions are ungraded": drops the
   * questions that can't be (closest_guess, via the Grading policy) and asks the
   * database which of the rest have an answer with no grading time. Used by
   * the reveal gate and the grading refresh.
   */
  private async listUngradedQuestionIds(
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
  private async getUngradedBlockQuestionIds(
    session: SessionState,
  ): Promise<number[]> {
    return this.listUngradedQuestionIds(
      session,
      getBlockInPlayIds(session.seededGame.rounds, session.progress),
    );
  }

  /**
   * Step 4 of gradeForMove (also run by gradeForPlacement). Bulk-refreshes the block through the grading refresh (the ungraded set
   * from the DB) whenever the block just entered (or is still within) a break status — the authoritative
   * baseline the grading refresh in GameStateService.submitAnswer/gradeAnswer
   * build on between these recomputes. A no-op outside the break statuses,
   * since nothing there can be graded and the cached value can't go stale.
   */
  private async refreshUngradedQuestionIds(
    session: SessionState,
    newProgress: GameProgress,
  ): Promise<SessionState> {
    if (!isBreakStatus(newProgress.status)) return session;
    const refresh = await this.readGradingRefresh(
      session,
      newProgress,
      getBlockInPlayIds(session.seededGame.rounds, newProgress),
    );
    // The refresh covers the whole block, so its set replaces the cached one
    // outright — nothing from an earlier block or a live edit survives.
    return {
      ...session,
      ungradedQuestionIds: [...refresh.ungradedQuestionIds],
    };
  }
}
