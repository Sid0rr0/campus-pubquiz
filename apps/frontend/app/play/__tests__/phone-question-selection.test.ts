import { describe, expect, it } from 'vitest';
import {
  browsedQuestionAfterAutoAdvanceChange,
  selectPhoneQuestion,
  type PhoneQuestionSelectionInput,
} from '@/app/play/phone-question-selection';

interface Q {
  id: number;
}

const q = (id: number): Q => ({ id });

function input(
  overrides: Partial<PhoneQuestionSelectionInput<Q>>,
): PhoneQuestionSelectionInput<Q> {
  return {
    openedQuestions: [],
    currentQuestion: null,
    onScreenQuestionId: null,
    browsedQuestionId: null,
    autoAdvanceEnabled: true,
    revealSyncKey: null,
    previousCurrentQuestionId: null,
    previousRevealSyncKey: null,
    ...overrides,
  };
}

describe('selectPhoneQuestion: which question the phone shows', () => {
  const cases: Array<{
    name: string;
    input: PhoneQuestionSelectionInput<Q>;
    expected: number | null;
  }> = [
    {
      name: 'follows the newest opened question by default',
      input: input({
        openedQuestions: [q(1), q(2), q(3)],
        currentQuestion: q(3),
      }),
      expected: 3,
    },
    {
      name: 'falls back to the current question when nothing is opened',
      input: input({ currentQuestion: q(7) }),
      expected: 7,
    },
    {
      name: 'shows nothing without opened questions or a current question',
      input: input({}),
      expected: null,
    },
    {
      name: 'stays on the newest when the display has stepped back',
      input: input({
        openedQuestions: [q(1), q(2), q(3)],
        currentQuestion: q(1),
      }),
      expected: 3,
    },
    {
      name: 'follows the question the big screen is revealing',
      input: input({
        openedQuestions: [q(1), q(2), q(3)],
        onScreenQuestionId: 2,
      }),
      expected: 2,
    },
    {
      name: 'ignores an on-screen question that is not in the block',
      input: input({
        openedQuestions: [q(1), q(2)],
        onScreenQuestionId: 99,
      }),
      expected: 2,
    },
    {
      name: 'lets the browsed question beat the reveal',
      input: input({
        openedQuestions: [q(1), q(2), q(3)],
        onScreenQuestionId: 2,
        browsedQuestionId: 1,
      }),
      expected: 1,
    },
    {
      name: 'ignores a browsed id that is no longer in the block',
      input: input({
        openedQuestions: [q(4), q(5)],
        onScreenQuestionId: 4,
        browsedQuestionId: 1,
      }),
      expected: 4,
    },
  ];

  it.each(cases)('$name', ({ input: scenario, expected }) => {
    expect(selectPhoneQuestion(scenario).selectedQuestion?.id ?? null).toBe(
      expected,
    );
  });
});

describe('selectPhoneQuestion: snap back and re-pin', () => {
  const cases: Array<{
    name: string;
    input: PhoneQuestionSelectionInput<Q>;
    expectedSelected: number | null;
    expectedBrowsed: number | null;
  }> = [
    {
      name: 'snaps back when a new question opens with auto-advance on',
      input: input({
        openedQuestions: [q(1), q(2), q(3)],
        currentQuestion: q(3),
        previousCurrentQuestionId: 2,
        browsedQuestionId: 1,
      }),
      expectedSelected: 3,
      expectedBrowsed: null,
    },
    {
      name: 'keeps the pick when a new question opens with auto-advance off',
      input: input({
        openedQuestions: [q(1), q(2), q(3)],
        currentQuestion: q(3),
        previousCurrentQuestionId: 2,
        browsedQuestionId: 1,
        autoAdvanceEnabled: false,
      }),
      expectedSelected: 1,
      expectedBrowsed: 1,
    },
    {
      name: 'snaps back on a reveal step with auto-advance on',
      input: input({
        openedQuestions: [q(1), q(2), q(3)],
        onScreenQuestionId: 2,
        revealSyncKey: 1,
        previousRevealSyncKey: 0,
        browsedQuestionId: 1,
      }),
      expectedSelected: 2,
      expectedBrowsed: null,
    },
    {
      name: 'keeps the pick on a reveal step with auto-advance off',
      input: input({
        openedQuestions: [q(1), q(2), q(3)],
        onScreenQuestionId: 2,
        revealSyncKey: 1,
        previousRevealSyncKey: 0,
        browsedQuestionId: 1,
        autoAdvanceEnabled: false,
      }),
      expectedSelected: 1,
      expectedBrowsed: 1,
    },
    {
      name: 'does not snap back when nothing changed',
      input: input({
        openedQuestions: [q(1), q(2), q(3)],
        currentQuestion: q(3),
        previousCurrentQuestionId: 3,
        revealSyncKey: 1,
        previousRevealSyncKey: 1,
        browsedQuestionId: 1,
      }),
      expectedSelected: 1,
      expectedBrowsed: 1,
    },
    {
      name: 'leaves a null pick null while following with auto-advance on',
      input: input({ openedQuestions: [q(1), q(2)], currentQuestion: q(2) }),
      expectedSelected: 2,
      expectedBrowsed: null,
    },
    {
      name: 're-pins the shown question right after auto-advance is turned off',
      input: input({
        openedQuestions: [q(1), q(2), q(3)],
        currentQuestion: q(3),
        previousCurrentQuestionId: 3,
        autoAdvanceEnabled: false,
      }),
      expectedSelected: 3,
      expectedBrowsed: 3,
    },
    {
      name: 're-pins when a new block replaces the pinned question',
      input: input({
        openedQuestions: [q(4), q(5)],
        currentQuestion: q(5),
        previousCurrentQuestionId: 5,
        browsedQuestionId: 1,
        autoAdvanceEnabled: false,
      }),
      expectedSelected: 5,
      expectedBrowsed: 5,
    },
    {
      name: 'keeps the pick when auto-advance is off and nothing can be shown',
      input: input({ browsedQuestionId: 1, autoAdvanceEnabled: false }),
      expectedSelected: null,
      expectedBrowsed: 1,
    },
  ];

  it.each(cases)('$name', (scenario) => {
    const result = selectPhoneQuestion(scenario.input);

    expect(result.selectedQuestion?.id ?? null).toBe(scenario.expectedSelected);
    expect(result.browsedQuestionId).toBe(scenario.expectedBrowsed);
  });
});

describe('browsedQuestionAfterAutoAdvanceChange', () => {
  it('clears the pick when auto-advance is turned on', () => {
    expect(browsedQuestionAfterAutoAdvanceChange(true, 2)).toBeNull();
  });

  it('keeps the pick when auto-advance is turned off', () => {
    expect(browsedQuestionAfterAutoAdvanceChange(false, 2)).toBe(2);
  });
});

describe('selectPhoneQuestion: neighbours', () => {
  const opened = [q(1), q(2), q(3)];
  const neighbourIds = (browsedQuestionId: number | null) => {
    const { previousQuestion, nextQuestion } = selectPhoneQuestion(
      input({ openedQuestions: opened, browsedQuestionId }),
    );
    return [previousQuestion?.id ?? null, nextQuestion?.id ?? null];
  };

  it('has only a next at the first question', () => {
    expect(neighbourIds(1)).toEqual([null, 2]);
  });

  it('has both in the middle', () => {
    expect(neighbourIds(2)).toEqual([1, 3]);
  });

  it('has only a previous at the last question', () => {
    expect(neighbourIds(3)).toEqual([2, null]);
  });

  it('has none with an empty block', () => {
    const result = selectPhoneQuestion(input({ currentQuestion: q(5) }));
    expect(result.previousQuestion).toBeNull();
    expect(result.nextQuestion).toBeNull();
  });

  it('has none when the shown question is only the current one, outside the block', () => {
    const result = selectPhoneQuestion(
      input({ openedQuestions: [], currentQuestion: q(5) }),
    );
    expect(result.selectedQuestion?.id).toBe(5);
    expect(result.previousQuestion).toBeNull();
    expect(result.nextQuestion).toBeNull();
  });
});

describe('selectPhoneQuestion: purity', () => {
  it('does not mutate its input', () => {
    const scenario = input({
      openedQuestions: [q(1), q(2)],
      currentQuestion: q(2),
      onScreenQuestionId: 1,
      browsedQuestionId: 2,
    });
    const snapshot = structuredClone(scenario);

    selectPhoneQuestion(scenario);

    expect(scenario).toEqual(snapshot);
  });
});
