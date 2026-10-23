import type { GameProgress } from '../game-state';
import type { SeededQuestion } from '../question-views';
import {
  DEFAULT_SESSION_SETTINGS,
  type SessionSettings,
} from '../session-settings';
import {
  freshSessionState,
  type SeededRound,
  type SessionState,
} from '../session-state';
import { lobby } from './game-state-fixtures';

export function freeText(id: number, overrides: Partial<SeededQuestion> = {}) {
  return {
    id,
    type: 'free_text' as const,
    prompt: `Question ${id}?`,
    answer: `answer ${id}`,
    points: 2,
    ...overrides,
  } satisfies SeededQuestion;
}

export function roundOf(
  id: number,
  questionIds: number[],
  overrides: Partial<SeededRound> = {},
): SeededRound {
  return {
    id,
    title: `Round ${id}`,
    breakAfter: true,
    questions: questionIds.map((questionId) => freeText(questionId)),
    ...overrides,
  };
}

/** A session over `rounds`, parked at `progress` (the lobby unless given). Nothing is settled: fields stay at their fresh defaults. */
export function sessionOver(
  rounds: SeededRound[],
  progress: GameProgress = lobby,
  settings: Partial<SessionSettings> = {},
): SessionState {
  return freshSessionState(
    {
      quizId: 1,
      gameSessionId: 1,
      joinCode: 'ABCDEF',
      quizTitle: 'Quiz',
      customName: null,
      startedAt: new Date(0),
      rounds,
      settings: { ...DEFAULT_SESSION_SETTINGS, ...settings },
    },
    progress,
  );
}

export function progressAt(
  status: GameProgress['status'],
  overrides: Partial<GameProgress> = {},
): GameProgress {
  return { ...lobby, status, ...overrides };
}
