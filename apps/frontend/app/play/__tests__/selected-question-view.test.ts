import { describe, expect, it } from 'vitest';
import { selectedQuestionViewOf } from '@/app/play/selected-question-view';

const question = { id: 2, roundNumber: 2 } as never;
const purchase = (questionId: number) =>
  ({ questionId, effect: { kind: 'fifty_fifty' } }) as never;

/** A block Phone screen in answering mode, with the team's answer to question 2 graded and revealed and round 2 doubled. */
const input = (overrides: Record<string, unknown> = {}) =>
  ({
    view: {
      phoneScreen: { kind: 'block', mode: 'answering' },
      isAnswerable: true,
      blockQuestions: [
        { id: 1, roundNumber: 1 },
        { id: 2, roundNumber: 2 },
      ],
    },
    myAnswers: { 2: { value: 'Paris', grade: null, clue: null } },
    myJokerExtras: { 2: 3 },
    myDoubledRounds: [{ roundId: 20, roundNumber: 2, title: 'Music' }],
    myPurchases: [purchase(2), purchase(1)],
    openedQuestions: [{ id: 2, pointsAwarded: 3, verdict: 'correct' }],
    selectedQuestion: question,
    ...overrides,
  }) as never;

describe('selectedQuestionViewOf', () => {
  it('is null with no selection', () => {
    expect(
      selectedQuestionViewOf(input({ selectedQuestion: null })),
    ).toBeNull();
  });

  it('holds the question, the answer and clue, the result, the doubled round and only its own purchases', () => {
    expect(selectedQuestionViewOf(input())).toEqual({
      question,
      answer: 'Paris',
      clue: null,
      points: 3,
      verdict: 'correct',
      jokerExtra: 3,
      isDoubledRound: true,
      purchases: [purchase(2)],
      isAnsweringNow: true,
    });
  });

  it('carries the recorded clue of a Clue answer', () => {
    const clue = { clue: 2, value: 4 };
    expect(
      selectedQuestionViewOf(
        input({ myAnswers: { 2: { value: 'x', grade: null, clue } } }),
      )?.clue,
    ).toEqual(clue);
  });

  it('has no answer while unanswered', () => {
    const view = selectedQuestionViewOf(input({ myAnswers: {} }));
    expect(view?.answer).toBeUndefined();
    expect(view?.clue).toBeNull();
  });

  it('has no result for an ungraded question, nor for one not opened', () => {
    expect(
      selectedQuestionViewOf(
        input({
          openedQuestions: [{ id: 2, pointsAwarded: null, verdict: null }],
        }),
      ),
    ).toMatchObject({ points: null, verdict: null });
    expect(
      selectedQuestionViewOf(
        input({
          openedQuestions: [{ id: 1, pointsAwarded: 3, verdict: 'correct' }],
        }),
      ),
    ).toMatchObject({ points: null, verdict: null, jokerExtra: null });
  });

  it('shows no joker extra when the server gave none for the question', () => {
    expect(
      selectedQuestionViewOf(input({ myJokerExtras: { 1: 3 } }))?.jokerExtra,
    ).toBeNull();
  });

  it('is not in a doubled round when its round is not doubled, or with none', () => {
    expect(
      selectedQuestionViewOf(
        input({ selectedQuestion: { id: 1, roundNumber: 1 } }),
      )?.isDoubledRound,
    ).toBe(false);
    expect(
      selectedQuestionViewOf(input({ myDoubledRounds: [] }))?.isDoubledRound,
    ).toBe(false);
  });

  it('is answered now only on the block Phone screen, in answering mode, while answerable', () => {
    const answeringNow = (view: unknown) =>
      selectedQuestionViewOf(
        input({ view: { blockQuestions: [], ...(view as object) } }),
      )?.isAnsweringNow;
    for (const mode of ['locked', 'revealing', 'answers']) {
      expect(
        answeringNow({
          phoneScreen: { kind: 'block', mode },
          isAnswerable: true,
        }),
      ).toBe(false);
    }
    expect(
      answeringNow({
        phoneScreen: { kind: 'block', mode: 'answering' },
        isAnswerable: false,
      }),
    ).toBe(false);
    expect(
      answeringNow({ phoneScreen: { kind: 'lobby' }, isAnswerable: true }),
    ).toBe(false);
    expect(
      answeringNow({
        phoneScreen: { kind: 'block', mode: 'answering' },
        isAnswerable: true,
      }),
    ).toBe(true);
  });
});
