import { Injectable, type OnModuleInit } from '@nestjs/common';
import {
  getNextGameState,
  type GameAction,
  type GameContext,
  type GameProgress,
  type LeaderboardEntry,
  type QuestionView,
  type StateSnapshotPayload,
} from '@campus-pubquiz/types';
import { SeedService } from '@/db/seed.service';
import type { SeededGame } from '@/db/seed.types';
import { GameProgressRepository } from '@/game/game-progress.repository';

@Injectable()
export class GameStateService implements OnModuleInit {
  private progress: GameProgress = {
    status: 'lobby',
    roundIndex: 0,
    questionIndex: 0,
    isLeaderboardVisible: false,
  };

  private seededGame: SeededGame | null = null;
  private leaderboard: LeaderboardEntry[] = [];

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

  setLeaderboard(leaderboard: LeaderboardEntry[]): void {
    this.leaderboard = leaderboard;
  }

  getSnapshot(): StateSnapshotPayload {
    return {
      progress: this.progress,
      currentQuestion: this.getCurrentQuestion(),
      leaderboard: this.leaderboard,
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
    if (
      this.progress.status !== 'question_open' &&
      this.progress.status !== 'locked'
    ) {
      return null;
    }
    return (
      this.getSeededGame().rounds[this.progress.roundIndex]?.questions[
        this.progress.questionIndex
      ] ?? null
    );
  }
}
