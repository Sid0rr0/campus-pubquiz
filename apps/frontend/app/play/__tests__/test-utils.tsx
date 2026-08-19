import { vi } from 'vitest';
import type { GameProgress } from '@campus-pubquiz/types';

export function progress(overrides: Partial<GameProgress> = {}): GameProgress {
  return {
    status: 'lobby',
    roundIndex: 0,
    questionIndex: 0,
    isLeaderboardVisible: false,
    revealIndex: 0,
    furthestOpenIndex: 0,
    ...overrides,
  };
}

export function socketResult(overrides: Record<string, unknown> = {}) {
  return {
    snapshot: null,
    connectionError: null,
    sendAction: vi.fn(),
    team: null,
    joinTeam: vi.fn(),
    submitAnswer: vi.fn(),
    liveAnswers: null,
    gradeAnswer: vi.fn(),
    myAnswers: {},
    seenQuestions: {},
    ...overrides,
  };
}
