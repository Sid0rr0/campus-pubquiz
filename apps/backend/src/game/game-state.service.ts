import { Injectable, type OnModuleInit } from '@nestjs/common';
import { CreateRequestContext, MikroORM } from '@mikro-orm/core';
import {
  getBlockStartRoundIndex,
  getNextGameState,
  getQuizStructureSummary,
  getRoundAndQuestionForBlockPosition,
  type ActiveSessionSummary,
  type AdminQuestionContext,
  type AnswerView,
  type BlockQuestionView,
  type BlockRevealQuestionView,
  type ClosestGuessRevealData,
  type GameAction,
  type GameContext,
  type GameProgress,
  type GameStatus,
  type LeaderboardEntry,
  type QuestionPosition,
  type QuestionView,
  type RevealQuestionView,
  type StateSnapshotPayload,
  type TeamView,
} from '@campus-pubquiz/types';
import { AnswerService } from '@/answer/answer.service';
import { SeedService } from '@/db/seed.service';
import type { SeededGame } from '@/db/seed.types';
import { GameProgressRepository } from '@/game/game-progress.repository';
import type { TeamRosterEntry } from '@/team/team.service';

const LOBBY_PROGRESS: GameProgress = {
  status: 'lobby',
  roundIndex: 0,
  questionIndex: 0,
  isLeaderboardVisible: false,
  revealIndex: 0,
  furthestOpenIndex: -1,
};

/** How long the 'locking' countdown runs before auto-advancing into the break. */
const QUESTION_LOCK_DURATION_MS = 60_000;

/** Everything GameStateService tracks for one concurrently-running GameSession, keyed by its joinCode. */
interface SessionState {
  seededGame: SeededGame;
  progress: GameProgress;
  /** Epoch-ms deadline for auto-locking the current question, or null when none is armed. */
  questionLockAt: number | null;
  leaderboard: LeaderboardEntry[];
  /**
   * How many teams (counting up from last place) are currently revealed on
   * the leaderboard. Ephemeral — not persisted, resets on toggle/new game.
   */
  leaderboardRevealCount: number;
  teams: TeamRosterEntry[];
  answeredTeamIdsByQuestion: Record<number, number[]>;
  /** teamId -> socket.id of the one device currently connected as that team. */
  connectedTeamSockets: Record<number, string>;
  /** closest_guess reveal-step counter for the question at progress.revealIndex — ephemeral, not persisted. */
  closestGuessRevealStep: number;
  /** Cached per-question closest_guess grading/summary, keyed by questionId — computed once when a block locks, ephemeral like leaderboardRevealCount. */
  closestGuessSummaries: Record<number, ClosestGuessRevealData>;
}

function freshSessionState(
  seededGame: SeededGame,
  progress: GameProgress,
): SessionState {
  return {
    seededGame,
    progress,
    questionLockAt: computeQuestionLockAt(progress),
    leaderboard: [],
    leaderboardRevealCount: 0,
    teams: [],
    answeredTeamIdsByQuestion: {},
    connectedTeamSockets: {},
    closestGuessRevealStep: 0,
    closestGuessSummaries: {},
  };
}

/** Summarizes a graded closest_guess question's answers into the display/play-facing reveal shape — pointsAwarded > 0 reliably identifies the tied-closest rows, since gradeClosestGuess awards full points to exactly those rows and 0 to everyone else. */
function summarizeClosestGuess(answers: AnswerView[]): ClosestGuessRevealData {
  const numeric = answers
    .map((answer) => ({ ...answer, parsed: Number(answer.value) }))
    .filter((answer) => Number.isFinite(answer.parsed));
  if (numeric.length === 0)
    return { hasSubmissions: false, closestGuesses: [] };
  const min = numeric.reduce((m, a) => (a.parsed < m.parsed ? a : m));
  const max = numeric.reduce((m, a) => (a.parsed > m.parsed ? a : m));
  return {
    hasSubmissions: true,
    minGuess: min.value,
    maxGuess: max.value,
    closestGuesses: answers
      .filter((answer) => answer.pointsAwarded > 0)
      .map((answer) => ({ teamName: answer.teamName, value: answer.value })),
  };
}

/**
 * Recomputes the auto-lock deadline for a given progress: armed only while
 * in the 'locking' countdown, so a gateway timer can advance into the break
 * automatically without the admin clicking Advance.
 */
function computeQuestionLockAt(progress: GameProgress): number | null {
  return progress.status === 'locking'
    ? Date.now() + QUESTION_LOCK_DURATION_MS
    : null;
}

/**
 * Toggling the board resets the reveal to nothing shown; from then on,
 * ADVANCE and REVEAL_NEXT_TEAM both step the reveal forward one team at a
 * time (bottom-up) — whichever button the admin has on screen works.
 */
function computeLeaderboardRevealCount(
  action: GameAction,
  newProgress: GameProgress,
  leaderboard: LeaderboardEntry[],
  currentRevealCount: number,
): number {
  if (action === 'TOGGLE_LEADERBOARD') {
    return 0;
  }
  if (
    (action === 'ADVANCE' || action === 'REVEAL_NEXT_TEAM') &&
    newProgress.isLeaderboardVisible
  ) {
    return Math.min(currentRevealCount + 1, leaderboard.length);
  }
  return currentRevealCount;
}

// Strips the correct answer: this projection is what leaves the process via
// currentQuestion/blockQuestions, broadcast to every phone and the big screen.
function toQuestionView(question: RevealQuestionView): QuestionView {
  return {
    id: question.id,
    type: question.type,
    prompt: question.prompt,
    points: question.points,
    ...(question.options !== undefined ? { options: question.options } : {}),
    ...(question.matchTargets !== undefined
      ? { matchTargets: question.matchTargets }
      : {}),
    ...(question.mediaUrl !== undefined ? { mediaUrl: question.mediaUrl } : {}),
    ...(question.mediaStartSeconds !== undefined
      ? { mediaStartSeconds: question.mediaStartSeconds }
      : {}),
    ...(question.mediaEndSeconds !== undefined
      ? { mediaEndSeconds: question.mediaEndSeconds }
      : {}),
  };
}

// Same answer-stripping, plus the round/question-in-round labels the block
// and break-review headers need.
function toBlockQuestionView(
  question: BlockRevealQuestionView,
): BlockQuestionView {
  return {
    ...toQuestionView(question),
    roundNumber: question.roundNumber,
    questionNumberInRound: question.questionNumberInRound,
    roundTitle: question.roundTitle,
  };
}

/** Thrown by closeSession when a joinCode can't be evicted from the in-memory map yet. */
export class SessionCloseBlockedError extends Error {
  constructor(joinCode: string, reason: string) {
    super(`Cannot close session "${joinCode}": ${reason}`);
    this.name = 'SessionCloseBlockedError';
  }
}

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
      this.getBlockQuestions(session).some(
        (question) => question.id === questionId,
      )
    );
  }

  getSnapshot(joinCode: string): StateSnapshotPayload {
    const session = this.getSession(joinCode);
    return {
      progress: session.progress,
      quizStructure: getQuizStructureSummary(this.getContext(session)),
      roundTitle: this.getCurrentRoundTitle(session),
      currentQuestion: this.getCurrentQuestion(session),
      blockQuestions: this.getBlockQuestions(session),
      upcomingQuestions: this.getUpcomingQuestionPositions(session),
      revealQuestions: this.getRevealQuestions(session),
      answeredTeamIds: this.getAnsweredTeamIds(session),
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
      const stepped = this.tryStepClosestGuessReveal(session, action);
      if (stepped) {
        this.sessions.set(joinCode, stepped);
        return this.getSnapshot(joinCode);
      }
    }

    const progress = getNextGameState(
      session.progress,
      action,
      this.getContext(session),
    );
    const gradedSession = await this.ensureBlockGraded(session, progress);
    const closestGuessRevealStep = this.computeInitialRevealStep(
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

  /** Resolves the seeded question a block-relative revealIndex points at, given roundIndex. */
  private getRevealTargetQuestion(
    session: SessionState,
    roundIndex: number,
    revealIndex: number,
  ): RevealQuestionView | undefined {
    const context = this.getContext(session);
    const blockStart = getBlockStartRoundIndex(roundIndex, context);
    const { roundIndex: targetRound, questionIndex } =
      getRoundAndQuestionForBlockPosition(blockStart, revealIndex, context);
    return session.seededGame.rounds[targetRound]?.questions[questionIndex];
  }

  /**
   * How many reveal sub-steps this question has. closest_guess with
   * submissions gets 5, cumulatively building up on one screen: (0) just the
   * question, (1) +smallest guess, (2) +highest guess, (3) +correct answer,
   * (4) +closest team(s) — each step keeps everything shown at the previous
   * step and adds one more line, it never replaces. Every other type, and
   * closest_guess with zero submissions, keeps today's single-shot behavior
   * (1 step: question + answer together immediately).
   */
  private getRevealStepCount(
    question: RevealQuestionView | undefined,
    session: SessionState,
  ): number {
    if (!question || question.type !== 'closest_guess') return 1;
    const summary = session.closestGuessSummaries[question.id];
    return summary?.hasSubmissions ? 5 : 1;
  }

  /** ADVANCE/PREVIOUS while mid-sequence on the current reveal question — null when there's nothing to gate (not closest_guess, single-step, or already at a boundary), signaling the caller to fall through to getNextGameState. */
  private tryStepClosestGuessReveal(
    session: SessionState,
    action: 'ADVANCE' | 'PREVIOUS',
  ): SessionState | null {
    const question = this.getRevealTargetQuestion(
      session,
      session.progress.roundIndex,
      session.progress.revealIndex,
    );
    const totalSteps = this.getRevealStepCount(question, session);
    if (totalSteps <= 1) return null;

    const step = session.closestGuessRevealStep;
    if (action === 'ADVANCE' && step < totalSteps - 1) {
      return { ...session, closestGuessRevealStep: step + 1 };
    }
    if (action === 'PREVIOUS' && step > 0) {
      return { ...session, closestGuessRevealStep: step - 1 };
    }
    return null;
  }

  /** Initializes the step counter whenever a (possibly new) question lands on 'reveal': 0 arriving forward (ADVANCE), last step arriving backward (PREVIOUS) — mirrors how PREVIOUS already resumes any other type fully revealed. */
  private computeInitialRevealStep(
    session: SessionState,
    progress: GameProgress,
    action: GameAction,
  ): number {
    if (progress.status !== 'reveal') return 0;
    const question = this.getRevealTargetQuestion(
      session,
      progress.roundIndex,
      progress.revealIndex,
    );
    const totalSteps = this.getRevealStepCount(question, session);
    return action === 'PREVIOUS' ? totalSteps - 1 : 0;
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

    const blockQuestions = this.getBlockSeededQuestions({
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

  private getContext(session: SessionState): GameContext {
    return {
      rounds: session.seededGame.rounds.map((round) => ({
        questionCount: round.questions.length,
        breakAfter: round.breakAfter,
      })),
    };
  }

  private getCurrentRoundTitle(session: SessionState): string {
    return session.seededGame.rounds[session.progress.roundIndex]?.title ?? '';
  }

  // Stays populated through 'locking' (not just 'question_open') so answers
  // remain submittable during the countdown — display simply doesn't render
  // it during 'locking', but /play keeps showing the last question.
  private getCurrentQuestion(session: SessionState): QuestionView | null {
    if (
      session.progress.status !== 'question_open' &&
      session.progress.status !== 'locking'
    ) {
      return null;
    }
    const question =
      session.seededGame.rounds[session.progress.roundIndex]?.questions[
        session.progress.questionIndex
      ];
    return question ? toQuestionView(question) : null;
  }

  /**
   * The block's questions (with their correct answers) revealed so far:
   * everything up to the furthest question ever opened (not just the one
   * currently on screen — PREVIOUS can walk the display backward without
   * re-hiding questions already shown) while the block is open (or locking),
   * during round_intro (Previous can step back into a round's intro card
   * without hiding that round's already-opened questions — furthestOpenIndex
   * naturally excludes anything from a round_intro reached by ADVANCE into a
   * fresh round, since it still points at the previous round/block), the
   * whole just-locked block during break/reveal, or — once the quiz has
   * ended — the last block ADVANCE walked through, so the admin can still
   * review/grade its answers instead of the panel vanishing the moment
   * reveal finishes. Empty otherwise.
   */
  private getBlockSeededQuestions(
    session: SessionState,
  ): BlockRevealQuestionView[] {
    const { status, roundIndex, questionIndex, furthestOpenIndex } =
      session.progress;
    if (
      status !== 'question_open' &&
      status !== 'locking' &&
      status !== 'round_intro' &&
      status !== 'break_intro' &&
      status !== 'break' &&
      status !== 'break_round_intro' &&
      status !== 'reveal_intro' &&
      status !== 'reveal' &&
      status !== 'ended'
    ) {
      return [];
    }

    const context = this.getContext(session);
    const rounds = session.seededGame.rounds;
    const blockStart = getBlockStartRoundIndex(roundIndex, context);
    const isOpenPhase =
      status === 'question_open' ||
      status === 'locking' ||
      status === 'round_intro';
    const revealBoundary = isOpenPhase
      ? getRoundAndQuestionForBlockPosition(
          blockStart,
          furthestOpenIndex,
          context,
        )
      : { roundIndex, questionIndex };

    return rounds
      .slice(blockStart, revealBoundary.roundIndex + 1)
      .flatMap((round, offset) => {
        const currentRoundIndex = blockStart + offset;
        const isCurrentRound = currentRoundIndex === revealBoundary.roundIndex;
        const isPartiallyRevealed = isOpenPhase && isCurrentRound;
        const questions = isPartiallyRevealed
          ? round.questions.slice(0, revealBoundary.questionIndex + 1)
          : round.questions;
        return questions.map((question, questionOffset) => ({
          ...question,
          ...(question.type === 'closest_guess'
            ? {
                closestGuess: session.closestGuessSummaries[question.id] ?? {
                  hasSubmissions: false,
                  closestGuesses: [],
                },
              }
            : {}),
          roundNumber: currentRoundIndex + 1,
          questionNumberInRound: questionOffset + 1,
          roundTitle: round.title,
        }));
      });
  }

  /**
   * Questions open for (re-)answering while a question is open, or the whole
   * just-locked block during break/reveal so the admin can browse answers
   * while grading. Answer-free: this is broadcast to every connected phone
   * and the big screen.
   */
  private getBlockQuestions(session: SessionState): BlockQuestionView[] {
    return this.getBlockSeededQuestions(session).map(toBlockQuestionView);
  }

  /**
   * Positions of the furthest-opened round's remaining questions, not open
   * yet — the whole round's shape, so the picker doesn't grow as questions
   * unlock. Based on furthestOpenIndex rather than the literal display
   * position, so stepping the display back with PREVIOUS doesn't re-mark
   * already-opened questions as upcoming. Round boundaries within a block
   * only advance through a round_intro screen, so these can only ever be
   * later in the furthest-opened round.
   *
   * During round_intro, furthestOpenIndex may still point at an earlier
   * round (a fresh round_intro reached by ADVANCE, nothing open in the new
   * round yet) — in that case the whole round about to start is upcoming,
   * not whatever's left of the round furthestOpenIndex still points at.
   */
  private getUpcomingQuestionPositions(
    session: SessionState,
  ): QuestionPosition[] {
    const { status, roundIndex, furthestOpenIndex } = session.progress;
    if (
      status !== 'question_open' &&
      status !== 'locking' &&
      status !== 'round_intro'
    ) {
      return [];
    }
    const context = this.getContext(session);
    const blockStart = getBlockStartRoundIndex(roundIndex, context);
    const furthest = getRoundAndQuestionForBlockPosition(
      blockStart,
      furthestOpenIndex,
      context,
    );
    const target =
      status === 'round_intro' && furthest.roundIndex < roundIndex
        ? { roundIndex, questionIndex: -1 }
        : furthest;
    const round = session.seededGame.rounds[target.roundIndex];
    if (!round) {
      return [];
    }
    const positions: QuestionPosition[] = [];
    for (
      let index = target.questionIndex + 1;
      index < round.questions.length;
      index += 1
    ) {
      positions.push({
        roundNumber: target.roundIndex + 1,
        questionNumberInRound: index + 1,
      });
    }
    return positions;
  }

  /**
   * The just-finished block's questions with correct answers, shown once
   * grading is done. Populated from the first reveal round intro card
   * onward (not just 'reveal' itself) so the display can read the upcoming
   * question's round title before its answer is actually shown.
   */
  private getRevealQuestions(session: SessionState): BlockRevealQuestionView[] {
    if (
      session.progress.status !== 'reveal_intro' &&
      session.progress.status !== 'reveal'
    ) {
      return [];
    }
    return this.getBlockSeededQuestions(session);
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

  private getAnsweredTeamIds(session: SessionState): number[] {
    const currentQuestion = this.getCurrentQuestion(session);
    if (!currentQuestion) {
      return [];
    }
    return session.answeredTeamIdsByQuestion[currentQuestion.id] ?? [];
  }
}
