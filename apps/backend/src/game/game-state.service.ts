import { Injectable, type OnModuleInit } from '@nestjs/common';
import { CreateRequestContext, MikroORM } from '@mikro-orm/core';
import {
  getBlockStartRoundIndex,
  getNextGameState,
  getQuizStructureSummary,
  type AdminQuestionContext,
  type BlockQuestionView,
  type BlockRevealQuestionView,
  type GameAction,
  type GameContext,
  type GameProgress,
  type LeaderboardEntry,
  type QuestionView,
  type RevealQuestionView,
  type StateSnapshotPayload,
  type TeamView,
} from '@campus-pubquiz/types';
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
};

/** How long the 'locking' countdown runs before auto-advancing into the break. */
const QUESTION_LOCK_DURATION_MS = 60_000;

// Strips the correct answer: this projection is what leaves the process via
// currentQuestion/blockQuestions, broadcast to every phone and the big screen.
function toQuestionView(question: RevealQuestionView): QuestionView {
  return {
    id: question.id,
    type: question.type,
    prompt: question.prompt,
    points: question.points,
    ...(question.options !== undefined ? { options: question.options } : {}),
    ...(question.mediaUrl !== undefined ? { mediaUrl: question.mediaUrl } : {}),
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
  };
}

@Injectable()
export class GameStateService implements OnModuleInit {
  private progress: GameProgress = { ...LOBBY_PROGRESS };
  /** Epoch-ms deadline for auto-locking the current question, or null when none is armed. */
  private questionLockAt: number | null = null;

  private seededGame: SeededGame | null = null;
  private leaderboard: LeaderboardEntry[] = [];
  /**
   * How many teams (counting up from last place) are currently revealed on
   * the leaderboard. Ephemeral — not persisted, resets on toggle/new game.
   */
  private leaderboardRevealCount = 0;
  private teams: TeamRosterEntry[] = [];
  private answeredTeamIdsByQuestion: Record<number, number[]> = {};
  /** teamId -> socket.id of the one device currently connected as that team. */
  private connectedTeamSockets: Record<number, string> = {};

  constructor(
    private readonly seedService: SeedService,
    private readonly progressRepository: GameProgressRepository,
    private readonly orm: MikroORM,
  ) {}

  // onModuleInit runs at bootstrap, before any HTTP/socket request has
  // entered the app, so there is no per-request MikroORM context yet for
  // the injected repositories to use — @CreateRequestContext() forks one.
  @CreateRequestContext()
  async onModuleInit(): Promise<void> {
    this.seededGame = await this.seedService.seed();
    const savedProgress = await this.progressRepository.load(
      this.seededGame.gameSessionId,
    );
    if (savedProgress) {
      this.progress = savedProgress;
    }
    this.updateQuestionLockAt();
  }

  getGameSessionId(): number {
    return this.getSeededGame().gameSessionId;
  }

  getActiveQuizId(): number {
    return this.getSeededGame().quizId;
  }

  async selectQuiz(quizId: number): Promise<StateSnapshotPayload> {
    if (this.progress.status !== 'lobby' && this.progress.status !== 'ended') {
      throw new Error(
        'A quiz can only be selected while the game is in the lobby or after the quiz has ended',
      );
    }

    const session = await this.seedService.createSession(quizId);
    this.seededGame = await this.seedService.loadGame(
      quizId,
      session.gameSessionId,
      session.joinCode,
    );
    // The fresh game_sessions row already starts in lobby state, so there is
    // no progress to persist here.
    this.progress = { ...LOBBY_PROGRESS };
    this.leaderboard = [];
    this.leaderboardRevealCount = 0;
    this.teams = [];
    this.answeredTeamIdsByQuestion = {};
    this.connectedTeamSockets = {};
    this.updateQuestionLockAt();
    return this.getSnapshot();
  }

  /**
   * Re-reads the active quiz's rounds from the database, keeping the current
   * session, join code and progress — used after a re-import updates the
   * active quiz's questions in place.
   */
  async reloadActiveQuiz(): Promise<void> {
    const { quizId, gameSessionId, joinCode } = this.getSeededGame();
    this.seededGame = await this.seedService.loadGame(
      quizId,
      gameSessionId,
      joinCode,
    );
  }

  setLeaderboard(leaderboard: LeaderboardEntry[]): void {
    this.leaderboard = leaderboard;
  }

  setTeams(teams: TeamRosterEntry[]): void {
    this.teams = teams;
  }

  getConnectedSocketId(teamId: number): string | undefined {
    return this.connectedTeamSockets[teamId];
  }

  setTeamConnected(teamId: number, socketId: string): void {
    this.connectedTeamSockets = {
      ...this.connectedTeamSockets,
      [teamId]: socketId,
    };
  }

  /** Called on socket disconnect; returns the teamId that was cleared, if any. */
  clearTeamConnectionBySocketId(socketId: string): number | null {
    const entry = Object.entries(this.connectedTeamSockets).find(
      ([, sid]) => sid === socketId,
    );
    if (!entry) return null;
    const [clearedTeamId] = entry;
    this.connectedTeamSockets = Object.fromEntries(
      Object.entries(this.connectedTeamSockets).filter(
        ([teamId]) => teamId !== clearedTeamId,
      ),
    );
    return Number(clearedTeamId);
  }

  setAnsweredTeamIds(questionId: number, teamIds: number[]): void {
    this.answeredTeamIdsByQuestion = {
      ...this.answeredTeamIdsByQuestion,
      [questionId]: teamIds,
    };
  }

  isQuestionOpenForAnswering(questionId: number): boolean {
    return (
      (this.progress.status === 'question_open' ||
        this.progress.status === 'locking') &&
      this.getBlockQuestions().some((question) => question.id === questionId)
    );
  }

  getSnapshot(): StateSnapshotPayload {
    return {
      progress: this.progress,
      quizStructure: getQuizStructureSummary(this.getContext()),
      roundTitle: this.getCurrentRoundTitle(),
      currentQuestion: this.getCurrentQuestion(),
      blockQuestions: this.getBlockQuestions(),
      revealQuestions: this.getRevealQuestions(),
      answeredTeamIds: this.getAnsweredTeamIds(),
      leaderboard: this.leaderboard,
      leaderboardRevealCount: this.leaderboardRevealCount,
      joinCode: this.getSeededGame().joinCode,
      teams: this.teams.map(
        (team): TeamView => ({
          ...team,
          isConnected: Boolean(this.connectedTeamSockets[team.teamId]),
        }),
      ),
      questionLockAt: this.questionLockAt,
    };
  }

  /** Epoch-ms deadline for auto-locking the current question, or null when none is armed. */
  getQuestionLockAt(): number | null {
    return this.questionLockAt;
  }

  async applyAction(action: GameAction): Promise<StateSnapshotPayload> {
    this.progress = getNextGameState(this.progress, action, this.getContext());
    this.updateQuestionLockAt();
    this.updateLeaderboardRevealCount(action);
    await this.progressRepository.save(this.getGameSessionId(), this.progress);
    return this.getSnapshot();
  }

  /**
   * Toggling the board resets the reveal to nothing shown; from then on,
   * ADVANCE and REVEAL_NEXT_TEAM both step the reveal forward one team at a
   * time (bottom-up) — whichever button the admin has on screen works.
   */
  private updateLeaderboardRevealCount(action: GameAction): void {
    if (action === 'TOGGLE_LEADERBOARD') {
      this.leaderboardRevealCount = 0;
      return;
    }
    if (
      (action === 'ADVANCE' || action === 'REVEAL_NEXT_TEAM') &&
      this.progress.isLeaderboardVisible
    ) {
      this.leaderboardRevealCount = Math.min(
        this.leaderboardRevealCount + 1,
        this.leaderboard.length,
      );
    }
  }

  /**
   * Recomputes the auto-lock deadline from the current progress: armed only
   * while in the 'locking' countdown, so a gateway timer can advance into the
   * break automatically without the admin clicking Advance.
   */
  private updateQuestionLockAt(): void {
    const shouldArm = this.progress.status === 'locking';
    this.questionLockAt = shouldArm
      ? Date.now() + QUESTION_LOCK_DURATION_MS
      : null;
  }

  private getSeededGame(): SeededGame {
    if (!this.seededGame) {
      throw new Error(
        'GameStateService used before initialization (onModuleInit has not resolved yet)',
      );
    }
    return this.seededGame;
  }

  private getContext(): GameContext {
    return {
      rounds: this.getSeededGame().rounds.map((round) => ({
        questionCount: round.questions.length,
        breakAfter: round.breakAfter,
      })),
    };
  }

  private getCurrentRoundTitle(): string {
    return this.getSeededGame().rounds[this.progress.roundIndex]?.title ?? '';
  }

  // Stays populated through 'locking' (not just 'question_open') so answers
  // remain submittable during the countdown — display simply doesn't render
  // it during 'locking', but /play keeps showing the last question.
  private getCurrentQuestion(): QuestionView | null {
    if (
      this.progress.status !== 'question_open' &&
      this.progress.status !== 'locking'
    ) {
      return null;
    }
    const question =
      this.getSeededGame().rounds[this.progress.roundIndex]?.questions[
        this.progress.questionIndex
      ];
    return question ? toQuestionView(question) : null;
  }

  /**
   * The block's questions (with their correct answers) revealed so far:
   * everything up to the current question while one is open (or locking),
   * or the whole just-locked block during break/reveal. Empty otherwise.
   */
  private getBlockSeededQuestions(): BlockRevealQuestionView[] {
    const { status, roundIndex, questionIndex } = this.progress;
    if (
      status !== 'question_open' &&
      status !== 'locking' &&
      status !== 'break' &&
      status !== 'reveal'
    ) {
      return [];
    }

    const rounds = this.getSeededGame().rounds;
    const blockStart = getBlockStartRoundIndex(roundIndex, this.getContext());

    return rounds.slice(blockStart, roundIndex + 1).flatMap((round, offset) => {
      const currentRoundIndex = blockStart + offset;
      const isCurrentRound = currentRoundIndex === roundIndex;
      const isPartiallyRevealed =
        (status === 'question_open' || status === 'locking') && isCurrentRound;
      const questions = isPartiallyRevealed
        ? round.questions.slice(0, questionIndex + 1)
        : round.questions;
      return questions.map((question, questionOffset) => ({
        ...question,
        roundNumber: currentRoundIndex + 1,
        questionNumberInRound: questionOffset + 1,
      }));
    });
  }

  /**
   * Questions open for (re-)answering while a question is open, or the whole
   * just-locked block during break/reveal so the admin can browse answers
   * while grading. Answer-free: this is broadcast to every connected phone
   * and the big screen.
   */
  private getBlockQuestions(): BlockQuestionView[] {
    return this.getBlockSeededQuestions().map(toBlockQuestionView);
  }

  /**
   * The just-finished block's questions with correct answers, shown once
   * grading is done. Only populated during reveal.
   */
  private getRevealQuestions(): BlockRevealQuestionView[] {
    if (this.progress.status !== 'reveal') {
      return [];
    }
    return this.getBlockSeededQuestions();
  }

  /**
   * Correct answer + round position for a question, for the admin grading
   * view alone. Callers MUST only forward this over an admin-room-only
   * channel (ANSWERS_UPDATED) — never through the broadcast snapshot.
   */
  getAdminQuestionContext(questionId: number): AdminQuestionContext | null {
    const rounds = this.getSeededGame().rounds;
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

  private getAnsweredTeamIds(): number[] {
    const currentQuestion = this.getCurrentQuestion();
    if (!currentQuestion) {
      return [];
    }
    return this.answeredTeamIdsByQuestion[currentQuestion.id] ?? [];
  }
}
