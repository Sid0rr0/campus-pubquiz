import { Injectable } from '@nestjs/common';
import {
  getNextGameState,
  type GameAction,
  type GameContext,
  type GameProgress,
  type QuestionView,
  type StateSnapshotPayload,
} from '@campus-pubquiz/types';
import { HARDCODED_QUIZ } from './hardcoded-quiz.fixture';

@Injectable()
export class GameStateService {
  private progress: GameProgress = {
    status: 'lobby',
    roundIndex: 0,
    questionIndex: 0,
    isLeaderboardVisible: false,
  };

  private readonly context: GameContext = {
    rounds: HARDCODED_QUIZ.rounds.map((round) => ({
      questionCount: round.questions.length,
      breakAfter: round.breakAfter,
    })),
  };

  getSnapshot(): StateSnapshotPayload {
    return {
      progress: this.progress,
      currentQuestion: this.getCurrentQuestion(),
      // Populated by AnswerService once grading exists (Milestone 2 Phase 5).
      leaderboard: [],
    };
  }

  applyAction(action: GameAction): StateSnapshotPayload {
    this.progress = getNextGameState(this.progress, action, this.context);
    return this.getSnapshot();
  }

  private getCurrentQuestion(): QuestionView | null {
    if (
      this.progress.status !== 'question_open' &&
      this.progress.status !== 'locked'
    ) {
      return null;
    }
    return (
      HARDCODED_QUIZ.rounds[this.progress.roundIndex]?.questions[
        this.progress.questionIndex
      ] ?? null
    );
  }
}
