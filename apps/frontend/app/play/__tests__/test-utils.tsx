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
    myAnswerGrades: {},
    myBonusAwards: [],
    seenQuestions: {},
    // A fixed "already connected" marker — useTeamJoin's join effect only
    // sends once this is non-null (it mirrors useGameSocket's real
    // post-connect timestamp), so tests that don't care about reconnect
    // timing need a stand-in value here to still see an immediate joinTeam
    // call. Tests exercising an actual second connection (retry, reconnect)
    // should override this with a distinct value of their own.
    reconnectedAt: 1,
    ...overrides,
  };
}
