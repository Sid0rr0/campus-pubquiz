import { Injectable, type OnModuleInit } from '@nestjs/common';
import {
  getBlockStartRoundIndex,
  getNextGameState,
  type GameAction,
  type GameContext,
  type GameProgress,
  type LeaderboardEntry,
  type QuestionView,
  type StateSnapshotPayload,
  type TeamView,
} from '@campus-pubquiz/types';
import { SeedService } from '@/db/seed.service';
import type { SeededGame } from '@/db/seed.types';
import { GameProgressRepository } from '@/game/game-progress.repository';

const LOBBY_PROGRESS: GameProgress = {
  status: 'lobby',
  roundIndex: 0,
  questionIndex: 0,
  isLeaderboardVisible: false,
};

@Injectable()
export class GameStateService implements OnModuleInit {
  private progress: GameProgress = { ...LOBBY_PROGRESS };

  private seededGame: SeededGame | null = null;
  private leaderboard: LeaderboardEntry[] = [];
  private teams: TeamView[] = [];
  private answeredTeamIdsByQuestion: Record<string, string[]> = {};

  constructor(
    private readonly seedService: SeedService,
    private readonly progressRepository: GameProgressRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    this.seededGame = await this.seedService.seed();
    const savedProgress = await this.progressRepository.load(
      this.seededGame.gameSessionId,
    );
    if (savedProgress) {
      this.progress = savedProgress;
    }
  }

  getGameSessionId(): string {
    return this.getSeededGame().gameSessionId;
  }

  getActiveQuizId(): string {
    return this.getSeededGame().quizId;
  }

  async selectQuiz(quizId: string): Promise<StateSnapshotPayload> {
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
    return this.getSnapshot();
  }

  setLeaderboard(leaderboard: LeaderboardEntry[]): void {
    this.leaderboard = leaderboard;
  }

  setTeams(teams: TeamView[]): void {
    this.teams = teams;
  }

  setAnsweredTeamIds(questionId: string, teamIds: string[]): void {
    this.answeredTeamIdsByQuestion = {
      ...this.answeredTeamIdsByQuestion,
      [questionId]: teamIds,
    };
  }

  isQuestionOpenForAnswering(questionId: string): boolean {
    return (
      this.progress.status === 'question_open' &&
      this.getBlockQuestions().some((question) => question.id === questionId)
    );
  }

  getSnapshot(): StateSnapshotPayload {
    return {
      progress: this.progress,
      currentQuestion: this.getCurrentQuestion(),
      blockQuestions: this.getBlockQuestions(),
      answeredTeamIds: this.getAnsweredTeamIds(),
      leaderboard: this.leaderboard,
      joinCode: this.getSeededGame().joinCode,
      teams: this.teams,
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
   * Questions open for (re-)answering while a question is open (everything
   * revealed so far in the current block), or the whole just-locked block
   * during break/reveal so the admin can browse answers while grading.
   */
  private getBlockQuestions(): QuestionView[] {
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

  private getAnsweredTeamIds(): string[] {
    const currentQuestion = this.getCurrentQuestion();
    if (!currentQuestion) {
      return [];
    }
    return this.answeredTeamIdsByQuestion[currentQuestion.id] ?? [];
  }
}
