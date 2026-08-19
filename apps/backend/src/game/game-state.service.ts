import { Injectable, type OnModuleInit } from '@nestjs/common';
import { CreateRequestContext, MikroORM } from '@mikro-orm/core';
import {
  getNextGameState,
  getQuizStructureSummary,
  type ActiveSessionSummary,
  type AdminQuestionContext,
  type GameAction,
  type GameProgress,
  type GameStatus,
  type LeaderboardEntry,
  type StateSnapshotPayload,
  type TeamView,
} from '@campus-pubquiz/types';
import { AnswerService } from '@/answer/answer.service';
import { SeedService } from '@/db/seed.service';
import {
  computeInitialRevealStep,
  summarizeClosestGuess,
  tryStepClosestGuessReveal,
} from '@/game/closest-guess-reveal.util';
import { GameProgressRepository } from '@/game/game-progress.repository';
import {
  getAnsweredTeamIds,
  getBlockQuestions,
  getBlockSeededQuestions,
  getCurrentQuestion,
  getCurrentRoundTitle,
  getRevealQuestions,
  getUpcomingQuestionPositions,
} from '@/game/block-questions.util';
import { computeLeaderboardRevealCount } from '@/game/leaderboard-reveal.util';
import { SessionCloseBlockedError } from '@/game/session-close-blocked.error';
import {
  LOBBY_PROGRESS,
  computeQuestionLockAt,
  freshSessionState,
  getGameContext,
  type SessionState,
} from '@/game/session-state';
import type { TeamRosterEntry } from '@/team/team.service';

export { SessionCloseBlockedError } from '@/game/session-close-blocked.error';

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
  async createSession(quizId: number): Promise<StateSnapshotPayload> {
    const created = await this.seedService.createSession(quizId);
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
    };
  }

  /** Epoch-ms deadline for auto-locking the current question, or null when none is armed. */
  getQuestionLockAt(joinCode: string): number | null {
    return this.getSession(joinCode).questionLockAt;
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
    const gradedSession = await this.ensureBlockGraded(session, progress);
    const closestGuessRevealStep = computeInitialRevealStep(
      gradedSession,
      progress,
      action,
    );
    const updated: SessionState = {
      ...gradedSession,
      progress,
      questionLockAt: computeQuestionLockAt(progress),
      leaderboardRevealCount: computeLeaderboardRevealCount(
        action,
        progress,
        gradedSession.leaderboard,
        gradedSession.leaderboardRevealCount,
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
    return { ...session, closestGuessSummaries: summaries };
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
