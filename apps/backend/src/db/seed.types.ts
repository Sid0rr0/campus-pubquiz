import type { QuestionView } from '@campus-pubquiz/types';

export interface SeededRound {
  id: string;
  breakAfter: boolean;
  questions: QuestionView[];
}

export interface SeededGame {
  quizId: string;
  gameSessionId: string;
  joinCode: string;
  rounds: SeededRound[];
}
