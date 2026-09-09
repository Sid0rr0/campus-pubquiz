import { describe, expect, it } from 'vitest';
import type { AnswersUpdatedPayload } from '@campus-pubquiz/types';
import { countCorrectAnswers } from '@/app/lib/count-correct-answers';

function liveAnswers(
  overrides: Partial<AnswersUpdatedPayload> = {},
): AnswersUpdatedPayload {
  return {
    questionId: 101,
    question: {
      type: 'free_text',
      prompt: 'Capital of France?',
      points: 2,
      correctAnswer: 'Paris',
      roundTitle: 'Geography',
      roundNumber: 1,
      questionNumberInRound: 1,
      totalQuestionsInRound: 1,
    },
    answers: [],
    ...overrides,
  };
}

describe('countCorrectAnswers', () => {
  it('counts only answers graded for the full question points', () => {
    const payload = liveAnswers({
      answers: [
        {
          answerId: 1,
          teamId: 1,
          teamName: 'The Quizzards',
          value: 'Paris',
          pointsAwarded: 2,
          gradedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          answerId: 2,
          teamId: 2,
          teamName: 'Beer Necessities',
          value: 'Paris',
          pointsAwarded: 1,
          gradedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          answerId: 3,
          teamId: 3,
          teamName: 'Quiz Pistols',
          value: 'London',
          pointsAwarded: 0,
          gradedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });

    expect(countCorrectAnswers(payload)).toBe(1);
  });

  it('excludes ungraded answers, which default to zero points', () => {
    const payload = liveAnswers({
      answers: [
        {
          answerId: 1,
          teamId: 1,
          teamName: 'The Quizzards',
          value: 'Paris',
          pointsAwarded: 0,
          gradedAt: null,
        },
      ],
    });

    expect(countCorrectAnswers(payload)).toBe(0);
  });

  it('returns 0 when no answers exist', () => {
    expect(countCorrectAnswers(liveAnswers())).toBe(0);
  });
});
