import type { RevealQuestionView } from '@campus-pubquiz/types';

export interface SeededRound {
  id: number;
  title: string;
  breakAfter: boolean;
  // Carries the correct answer internally so reveal can show it; only
  // GameStateService's answer-free QuestionView projections leave the process.
  questions: RevealQuestionView[];
}

export interface SeededGame {
  quizId: number;
  gameSessionId: number;
  joinCode: string;
  rounds: SeededRound[];
}

export interface CreatedGameSession {
  gameSessionId: number;
  joinCode: string;
}
