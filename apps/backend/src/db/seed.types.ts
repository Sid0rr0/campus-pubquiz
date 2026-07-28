import type { RevealQuestionView } from '@campus-pubquiz/types';

export interface SeededRound {
  id: string;
  breakAfter: boolean;
  // Carries the correct answer internally so reveal can show it; only
  // GameStateService's answer-free QuestionView projections leave the process.
  questions: RevealQuestionView[];
}

export interface SeededGame {
  quizId: string;
  gameSessionId: string;
  joinCode: string;
  rounds: SeededRound[];
}

export interface CreatedGameSession {
  gameSessionId: string;
  joinCode: string;
}
