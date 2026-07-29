import { Injectable, type OnModuleInit } from '@nestjs/common';
import { CreateRequestContext, MikroORM } from '@mikro-orm/core';
import {
  getBlockStartRoundIndex,
  getNextGameState,
  getQuizStructureSummary,
  type AdminQuestionContext,
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

@Injectable()
export class GameStateService implements OnModuleInit {
  private progress: GameProgress = { ...LOBBY_PROGRESS };

  private seededGame: SeededGame | null = null;
  private leaderboard: LeaderboardEntry[] = [];
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
    this.teams = [];
    this.answeredTeamIdsByQuestion = {};
    this.connectedTeamSockets = {};
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
      this.progress.status === 'question_open' &&
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
      joinCode: this.getSeededGame().joinCode,
      teams: this.teams.map(
        (team): TeamView => ({
          ...team,
          isConnected: Boolean(this.connectedTeamSockets[team.teamId]),
        }),
      ),
    };
  }

  async applyAction(action: GameAction): Promise<StateSnapshotPayload> {
    this.progress = getNextGameState(this.progress, action, this.getContext());
    await this.progressRepository.save(this.getGameSessionId(), this.progress);
    return this.getSnapshot();
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

  private getCurrentQuestion(): QuestionView | null {
    if (this.progress.status !== 'question_open') {
      return null;
    }
    return (
      this.getSeededGame().rounds[this.progress.roundIndex]?.questions[
        this.progress.questionIndex
      ] ?? null
    );
  }

  /**
   * The block's questions (with their correct answers) revealed so far:
   * everything up to the current question while one is open, or the whole
   * just-locked block during break/reveal. Empty outside those statuses.
   */
  private getBlockSeededQuestions(): RevealQuestionView[] {
    const { status, roundIndex, questionIndex } = this.progress;
    if (
      status !== 'question_open' &&
      status !== 'break' &&
      status !== 'reveal'
    ) {
      return [];
    }

    const rounds = this.getSeededGame().rounds;
    const blockStart = getBlockStartRoundIndex(roundIndex, this.getContext());

    return rounds.slice(blockStart, roundIndex + 1).flatMap((round, offset) => {
      const isCurrentRound = blockStart + offset === roundIndex;
      const isPartiallyRevealed = status === 'question_open' && isCurrentRound;
      return isPartiallyRevealed
        ? round.questions.slice(0, questionIndex + 1)
        : round.questions;
    });
  }

  /**
   * Questions open for (re-)answering while a question is open, or the whole
   * just-locked block during break/reveal so the admin can browse answers
   * while grading. Answer-free: this is broadcast to every connected phone
   * and the big screen.
   */
  private getBlockQuestions(): QuestionView[] {
    return this.getBlockSeededQuestions().map(toQuestionView);
  }

  /**
   * The just-finished block's questions with correct answers, shown once
   * grading is done. Only populated during reveal.
   */
  private getRevealQuestions(): RevealQuestionView[] {
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
