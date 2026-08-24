import { Injectable, type OnModuleInit } from '@nestjs/common';
import { CreateRequestContext, MikroORM } from '@mikro-orm/core';
import {
  DEFAULT_SESSION_SETTINGS,
  getNextGameState,
  getQuizStructureSummary,
  type ActiveSessionSummary,
  type AdminQuestionContext,
  type GameAction,
  type GameProgress,
  type GameStatus,
  type LeaderboardEntry,
  type SessionSettings,
  type StateSnapshotPayload,
  type TeamView,
} from '@campus-pubquiz/types';
import { AnswerService } from '@/answer/answer.service';
import { SeedService } from '@/db/seed.service';
import {
  computeInitialRevealStep,
  summarizeClosestGuess,
  tryStepClosestGuessReveal,
} from '@/game/state/closest-guess-reveal.util';
import { GameProgressRepository } from '@/game/state/game-progress.repository';
import {
  getAnsweredTeamIds,
  getBlockQuestions,
  getBlockSeededQuestions,
  getCurrentQuestion,
  getCurrentRoundTitle,
  getPastRevealedQuestions,
  getRevealQuestions,
  getUpcomingQuestionPositions,
} from '@/game/state/block-questions.util';
import { computeLeaderboardRevealCount } from '@/game/state/leaderboard-reveal.util';
import { SessionCloseBlockedError } from '@/game/state/errors/session-close-blocked.error';
import { SessionSettingsUpdateBlockedError } from '@/game/state/errors/session-settings-update-blocked.error';
import {
  LOBBY_PROGRESS,
  computeQuestionLockAt,
  freshSessionState,
  getGameContext,
  type SessionState,
} from '@/game/state/session-state';
import { UngradedAnswersError } from '@/game/state/errors/ungraded-answers.error';
import type { TeamRosterEntry } from '@/team/team.service';

export { SessionCloseBlockedError } from '@/game/state/errors/session-close-blocked.error';
export { SessionSettingsUpdateBlockedError } from '@/game/state/errors/session-settings-update-blocked.error';
export { UngradedAnswersError } from '@/game/state/errors/ungraded-answers.error';

/** Statuses in which the break/grading screens are actively reviewing the just-locked block — the window where ungradedQuestionIds is kept fresh. */
const GRADING_STATUSES: GameStatus[] = [
  'break_intro',
  'break',
  'break_round_intro',
];

@Injectable()
export class GameStateService implements OnModuleInit {
  private readonly sessions = new Map<string, SessionState>();
  /** Whether onModuleInit has resolved — lets getSession distinguish "used too early" from "unknown joinCode". */
  private initialized = false;

  constructor(
    private readonly seedService: SeedService,
    private readonly progressRepository: GameProgressRepository,
    private readonly orm: MikroORM,
    private readonly answerService: AnswerService,
  ) {}

  // onModuleInit runs at bootstrap, before any HTTP/socket request has
  // entered the app, so there is no per-request MikroORM context yet for
  // the injected repositories to use — @CreateRequestContext() forks one.
  @CreateRequestContext()
  async onModuleInit(): Promise<void> {
    const seededGame = await this.seedService.seed();
    const savedProgress = await this.progressRepository.load(
      seededGame.gameSessionId,
    );
    const session = freshSessionState(
      seededGame,
      savedProgress ?? { ...LOBBY_PROGRESS },
    );
    this.sessions.set(seededGame.joinCode, session);
    this.initialized = true;
  }

  /** Whether a session exists for this joinCode — lets the gateway reject a handshake's `?code=` before trusting it. */
  hasSession(joinCode: string): boolean {
    return this.sessions.has(joinCode);
  }

  getGameSessionId(joinCode: string): number {
    return this.getSession(joinCode).seededGame.gameSessionId;
  }

  getActiveQuizId(joinCode: string): number {
    return this.getSession(joinCode).seededGame.quizId;
  }

  /** Every currently-running session, for the admin session picker (`GET /sessions`). Titles are filled in by the caller — this service only knows quizId, not quiz metadata. */
  listSessions(): Omit<ActiveSessionSummary, 'quizTitle'>[] {
    return Array.from(this.sessions.values()).map((session) => ({
      joinCode: session.seededGame.joinCode,
      quizId: session.seededGame.quizId,
      status: session.progress.status,
      teamCount: session.teams.length,
    }));
  }

  /**
   * Evicts a session's in-memory state once it's done — the eviction policy
   * decided for phase 4: explicit admin action rather than an idle-timeout
   * sweep, since it's deterministic and needs no background timer. Only
   * allowed once the quiz has `ended` — closing a live game would strand any
   * still-connected display/players.
   */
  closeSession(joinCode: string): void {
    const session = this.getSession(joinCode);
    if (session.progress.status !== 'ended') {
      throw new SessionCloseBlockedError(
        joinCode,
        `still in progress (status: "${session.progress.status}")`,
      );
    }
    this.sessions.delete(joinCode);
  }

  /**
   * Allocates a brand-new GameSession/joinCode for `quizId`, leaving any
   * other session's state untouched. Not blocked by another session's
   * progress — `POST /sessions` lets an admin start additional concurrent
   * games regardless of how far along any other session is.
   */
  async createSession(
    quizId: number,
    settings: SessionSettings = DEFAULT_SESSION_SETTINGS,
  ): Promise<StateSnapshotPayload> {
    const created = await this.seedService.createSession(quizId, settings);
    const seededGame = await this.seedService.loadGame(
      quizId,
      created.gameSessionId,
      created.joinCode,
    );
    // The fresh game_sessions row already starts in lobby state, so there is
    // no progress to persist here.
    const session = freshSessionState(seededGame, { ...LOBBY_PROGRESS });
    this.sessions.set(seededGame.joinCode, session);
    return this.getSnapshot(seededGame.joinCode);
  }

  /**
   * Re-reads the active quiz's rounds from the database, keeping the
   * session, join code and progress — used after a re-import updates the
   * active quiz's questions in place.
   */
  async reloadActiveQuiz(joinCode: string): Promise<void> {
    const session = this.getSession(joinCode);
    const { quizId, gameSessionId } = session.seededGame;
    const seededGame = await this.seedService.loadGame(
      quizId,
      gameSessionId,
      joinCode,
    );
    this.sessions.set(joinCode, { ...session, seededGame });
  }

  setLeaderboard(joinCode: string, leaderboard: LeaderboardEntry[]): void {
    const session = this.getSession(joinCode);
    this.sessions.set(joinCode, { ...session, leaderboard });
  }

  setTeams(joinCode: string, teams: TeamRosterEntry[]): void {
    const session = this.getSession(joinCode);
    this.sessions.set(joinCode, { ...session, teams });
  }

  getConnectedSocketId(joinCode: string, teamId: number): string | undefined {
    return this.getSession(joinCode).connectedTeamSockets[teamId];
  }

  setTeamConnected(joinCode: string, teamId: number, socketId: string): void {
    const session = this.getSession(joinCode);
    this.sessions.set(joinCode, {
      ...session,
      connectedTeamSockets: {
        ...session.connectedTeamSockets,
        [teamId]: socketId,
      },
    });
  }

  /** Called on socket disconnect; returns the teamId that was cleared, if any. */
  clearTeamConnectionBySocketId(
    joinCode: string,
    socketId: string,
  ): number | null {
    const session = this.getSession(joinCode);
    const entry = Object.entries(session.connectedTeamSockets).find(
      ([, sid]) => sid === socketId,
    );
    if (!entry) return null;
    const [clearedTeamId] = entry;
    this.sessions.set(joinCode, {
      ...session,
      connectedTeamSockets: Object.fromEntries(
        Object.entries(session.connectedTeamSockets).filter(
          ([teamId]) => teamId !== clearedTeamId,
        ),
      ),
    });
    return Number(clearedTeamId);
  }

  setAnsweredTeamIds(
    joinCode: string,
    questionId: number,
    teamIds: number[],
  ): void {
    const session = this.getSession(joinCode);
    this.sessions.set(joinCode, {
      ...session,
      answeredTeamIdsByQuestion: {
        ...session.answeredTeamIdsByQuestion,
        [questionId]: teamIds,
      },
    });
  }

  isQuestionOpenForAnswering(joinCode: string, questionId: number): boolean {
    const session = this.getSession(joinCode);
    return (
      (session.progress.status === 'question_open' ||
        session.progress.status === 'locking' ||
        session.progress.status === 'round_intro') &&
      getBlockQuestions(session).some((question) => question.id === questionId)
    );
  }

  getSnapshot(joinCode: string): StateSnapshotPayload {
    const session = this.getSession(joinCode);
    return {
      progress: session.progress,
      quizStructure: getQuizStructureSummary(getGameContext(session)),
      roundTitle: getCurrentRoundTitle(session),
      currentQuestion: getCurrentQuestion(session),
      blockQuestions: getBlockQuestions(session),
      upcomingQuestions: getUpcomingQuestionPositions(session),
      revealQuestions: getRevealQuestions(session),
      pastRevealedQuestions: getPastRevealedQuestions(session),
      ungradedQuestionIds: session.ungradedQuestionIds,
      answeredTeamIds: getAnsweredTeamIds(session),
      leaderboard: session.leaderboard,
      leaderboardRevealCount: session.leaderboardRevealCount,
      joinCode: session.seededGame.joinCode,
      teams: session.teams.map(
        (team): TeamView => ({
          ...team,
          isConnected: Boolean(session.connectedTeamSockets[team.teamId]),
        }),
      ),
      questionLockAt: session.questionLockAt,
      closestGuessRevealStep: session.closestGuessRevealStep,
      breakEndsAt: session.breakEndsAt,
      settings: session.seededGame.settings,
    };
  }

  /** Epoch-ms deadline for auto-locking the current question, or null when none is armed. */
  getQuestionLockAt(joinCode: string): number | null {
    return this.getSession(joinCode).questionLockAt;
  }

  /** Admin-set/clear the epoch-ms time the break is expected to end — see StateSnapshotPayload.breakEndsAt. */
  setBreakEndTime(joinCode: string, breakEndsAt: number | null): void {
    const session = this.getSession(joinCode);
    this.sessions.set(joinCode, { ...session, breakEndsAt });
  }

  /** This session's current settings — used by the gateway to filter enabled bonus categories. */
  getSessionSettings(joinCode: string): SessionSettings {
    return this.getSession(joinCode).seededGame.settings;
  }

  /**
   * Merges `partial` over the session's current settings, lobby-only — the
   * admin can keep adjusting settings freely up until START_QUIZ, at which
   * point the values in effect must stop moving under the game.
   */
  async updateSessionSettings(
    joinCode: string,
    partial: Partial<SessionSettings>,
  ): Promise<void> {
    const session = this.getSession(joinCode);
    if (session.progress.status !== 'lobby') {
      throw new SessionSettingsUpdateBlockedError(
        joinCode,
        `already started (status: "${session.progress.status}")`,
      );
    }
    const settings = { ...session.seededGame.settings, ...partial };
    await this.seedService.updateSettings(
      session.seededGame.gameSessionId,
      settings,
    );
    this.sessions.set(joinCode, {
      ...session,
      seededGame: { ...session.seededGame, settings },
    });
  }

  async applyAction(
    joinCode: string,
    action: GameAction,
  ): Promise<StateSnapshotPayload> {
    const session = this.getSession(joinCode);

    // Mid-reveal-sequence intercept for closest_guess questions — never
    // reaches getNextGameState, GameProgress untouched, nothing persisted.
    // See tryStepClosestGuessReveal for why this stays entirely ephemeral.
    if (
      (action === 'ADVANCE' || action === 'PREVIOUS') &&
      session.progress.status === 'reveal'
    ) {
      const stepped = tryStepClosestGuessReveal(session, action);
      if (stepped) {
        this.sessions.set(joinCode, stepped);
        return this.getSnapshot(joinCode);
      }
    }

    const progress = getNextGameState(
      session.progress,
      action,
      getGameContext(session),
    );

    // Committing out of the break/grading screens into reveal — the one
    // moment this must be DB-authoritative rather than relying on the
    // (possibly stale, e.g. post-restart) ungradedQuestionIds cache below.
    if (
      action === 'ADVANCE' &&
      (session.progress.status === 'break_intro' ||
        session.progress.status === 'break') &&
      progress.status === 'reveal_intro'
    ) {
      const ungradedQuestionIds =
        await this.getUngradedBlockQuestionIds(session);
      if (ungradedQuestionIds.length > 0) {
        throw new UngradedAnswersError(ungradedQuestionIds);
      }
    }

    const gradedSession = await this.ensureBlockGraded(session, progress);
    const sessionWithGradingStatus = await this.refreshUngradedQuestionIds(
      gradedSession,
      progress,
    );
    const closestGuessRevealStep = computeInitialRevealStep(
      sessionWithGradingStatus,
      progress,
      action,
    );
    const updated: SessionState = {
      ...sessionWithGradingStatus,
      progress,
      questionLockAt: computeQuestionLockAt(
        progress,
        sessionWithGradingStatus.seededGame.settings.lockGraceSeconds * 1000,
      ),
      // A fresh break starting (the only path into 'break_intro') clears any
      // end-time left over from a previous break, so the admin sets a new
      // one rather than the display showing a stale/past time. Navigating
      // within the same break (break_intro/break/break_round_intro) via
      // Previous/Advance leaves it untouched.
      breakEndsAt:
        session.progress.status === 'locking' &&
        progress.status === 'break_intro'
          ? null
          : sessionWithGradingStatus.breakEndsAt,
      leaderboardRevealCount: computeLeaderboardRevealCount(
        action,
        session.progress.isLeaderboardVisible,
        progress,
        sessionWithGradingStatus.leaderboard,
        sessionWithGradingStatus.leaderboardRevealCount,
      ),
      closestGuessRevealStep,
    };
    this.sessions.set(joinCode, updated);
    await this.progressRepository.save(
      updated.seededGame.gameSessionId,
      progress,
    );
    return this.getSnapshot(joinCode);
  }

  /** Batch-grades every closest_guess question in the block once it reaches a graded status, caching the result — safe to call every applyAction since it skips questions already in closestGuessSummaries. */
  private async ensureBlockGraded(
    session: SessionState,
    newProgress: GameProgress,
  ): Promise<SessionState> {
    const GRADED_STATUSES: GameStatus[] = [
      'break_intro',
      'break',
      'break_round_intro',
      'reveal_intro',
      'reveal',
      'ended',
    ];
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
  private async getUngradedBlockQuestionIds(
    session: SessionState,
  ): Promise<number[]> {
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
  private async refreshUngradedQuestionIds(
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

  /** Incrementally patches the ungraded-question cache for one questionId — called by the gateway right after SUBMIT_ANSWER/GRADE_ANSWER, which grade individual answers without going through applyAction's bulk refresh. */
  setQuestionGradedStatus(
    joinCode: string,
    questionId: number,
    hasUngradedAnswers: boolean,
  ): void {
    const session = this.getSession(joinCode);
    const withoutQuestion = session.ungradedQuestionIds.filter(
      (id) => id !== questionId,
    );
    this.sessions.set(joinCode, {
      ...session,
      ungradedQuestionIds: hasUngradedAnswers
        ? [...withoutQuestion, questionId]
        : withoutQuestion,
    });
  }

  private getSession(joinCode: string): SessionState {
    // Distinguishing "never initialized" from "unknown joinCode" gives
    // onModuleInit-ordering bugs a clearer error than a generic lookup miss.
    if (!this.initialized) {
      throw new Error(
        'GameStateService used before initialization (onModuleInit has not resolved yet)',
      );
    }
    const session = this.sessions.get(joinCode);
    if (!session) {
      throw new Error(`Unknown game session for join code "${joinCode}"`);
    }
    return session;
  }

  /**
   * Correct answer + round position for a question, for the admin grading
   * view alone. Callers MUST only forward this over an admin-room-only
   * channel (ANSWERS_UPDATED) — never through the broadcast snapshot.
   */
  getAdminQuestionContext(
    joinCode: string,
    questionId: number,
  ): AdminQuestionContext | null {
    const rounds = this.getSession(joinCode).seededGame.rounds;
    for (const [roundOffset, round] of rounds.entries()) {
      const questionOffset = round.questions.findIndex(
        (question) => question.id === questionId,
      );
      if (questionOffset === -1) continue;

      const question = round.questions[questionOffset];
      return {
        type: question.type,
        prompt: question.prompt,
        ...(question.options !== undefined
          ? { options: question.options }
          : {}),
        ...(question.matchTargets !== undefined
          ? { matchTargets: question.matchTargets }
          : {}),
        ...(question.mediaUrl !== undefined
          ? { mediaUrl: question.mediaUrl }
          : {}),
        points: question.points,
        correctAnswer: question.answer,
        roundTitle: round.title,
        roundNumber: roundOffset + 1,
        questionNumberInRound: questionOffset + 1,
        totalQuestionsInRound: round.questions.length,
      };
    }
    return null;
  }
}
