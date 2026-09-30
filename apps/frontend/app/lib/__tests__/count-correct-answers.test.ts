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
  it('counts only answers with a correct verdict, not partial or incorrect ones', () => {
    const payload = liveAnswers({
      answers: [
        {
          answerId: 1,
          teamId: 1,
          teamName: 'The Quizzards',
          value: 'Paris',
          pointsAwarded: 2,
          gradedAt: '2026-01-01T00:00:00.000Z',
          verdict: 'correct',
        },
        {
          answerId: 2,
          teamId: 2,
          teamName: 'Beer Necessities',
          value: 'Paris',
          pointsAwarded: 1,
          gradedAt: '2026-01-01T00:00:00.000Z',
          verdict: 'partial',
        },
        {
          answerId: 3,
          teamId: 3,
          teamName: 'Quiz Pistols',
          value: 'London',
          pointsAwarded: 0,
          gradedAt: '2026-01-01T00:00:00.000Z',
          verdict: 'incorrect',
        },
      ],
    });

    expect(countCorrectAnswers(payload)).toBe(1);
  });

  it('counts a speed-scaled kahoot answer that earned fewer than the full points', () => {
    const payload = liveAnswers({
      question: { ...liveAnswers().question, points: 1000 },
      answers: [
        {
          answerId: 1,
          teamId: 1,
          teamName: 'The Quizzards',
          value: 'Paris',
          pointsAwarded: 640,
          gradedAt: '2026-01-01T00:00:00.000Z',
          verdict: 'correct',
        },
      ],
    });

    expect(countCorrectAnswers(payload)).toBe(1);
  });

  it('counts an answer the admin overrode up to full points once its verdict updates', () => {
    const answer = {
      answerId: 1,
      teamId: 1,
      teamName: 'The Quizzards',
      value: 'Pariss',
      pointsAwarded: 0,
      gradedAt: '2026-01-01T00:00:00.000Z',
    };
    const before = liveAnswers({
      answers: [{ ...answer, verdict: 'incorrect' }],
    });
    const after = liveAnswers({
      answers: [{ ...answer, pointsAwarded: 2, verdict: 'correct' }],
    });

    expect([countCorrectAnswers(before), countCorrectAnswers(after)]).toEqual([
      0, 1,
    ]);
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
          verdict: null,
        },
      ],
    });

    expect(countCorrectAnswers(payload)).toBe(0);
  });

  it('returns 0 when no answers exist', () => {
    expect(countCorrectAnswers(liveAnswers())).toBe(0);
  });
});
