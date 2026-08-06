import { vi } from 'vitest';

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
    ...overrides,
  };
}
