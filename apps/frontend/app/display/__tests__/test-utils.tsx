import type { GameProgress, QuestionView } from '@campus-pubquiz/types';

export function progress(overrides: Partial<GameProgress> = {}): GameProgress {
  return {
    status: 'lobby',
    roundIndex: 0,
    questionIndex: 0,
    isLeaderboardVisible: false,
    revealIndex: 0,
    ...overrides,
  };
}

export const question: QuestionView = {
  id: 1,
  type: 'multiple_choice',
  prompt: 'Capital of France?',
  options: ['Paris', 'London'],
  points: 2,
};
