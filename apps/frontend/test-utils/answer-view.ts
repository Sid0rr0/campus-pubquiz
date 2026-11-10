import type { AnswerView } from '@campus-pubquiz/types';

/** An ungraded answer; a new field on AnswerView gets its default here, not in every test. */
export function answerView(overrides: Partial<AnswerView> = {}): AnswerView {
  return {
    answerId: 1,
    teamId: 1,
    teamName: 'The Quizzards',
    value: 'Paris',
    pointsAwarded: 0,
    gradingState: 'ungraded',
    gradedAt: null,
    verdict: null,
    powerUps: [],
    clue: null,
    clueValue: null,
    ...overrides,
  };
}
