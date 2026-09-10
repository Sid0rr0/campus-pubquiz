import type { ImportRoundPreview } from '@campus-pubquiz/types';
import { findLiveEditViolations } from '@/quiz/live-edit-guard';

function round(
  overrides: Partial<ImportRoundPreview> = {},
): ImportRoundPreview {
  return {
    title: 'Round 1',
    breakAfter: false,
    questions: [
      {
        questionId: 1,
        type: 'free_text',
        prompt: 'Q1',
        answer: 'A1',
        points: 1,
      },
      {
        questionId: 2,
        type: 'free_text',
        prompt: 'Q2',
        answer: 'A2',
        points: 1,
      },
    ],
    ...overrides,
  };
}

describe('findLiveEditViolations', () => {
  it('returns no issues when nothing changed', () => {
    const rounds = [round()];
    expect(findLiveEditViolations(rounds, rounds, [])).toEqual([]);
  });

  it('rejects adding or removing a round', () => {
    const current = [round()];
    const incoming = [round(), round({ title: 'Round 2' })];

    const issues = findLiveEditViolations(current, incoming, []);

    expect(issues).toEqual([
      expect.objectContaining({
        roundIndex: -1,
        questionIndex: null,
        field: 'rounds',
      }),
    ]);
  });

  it('rejects adding or removing a question within a round', () => {
    const current = [round()];
    const incoming = [
      round({
        questions: [
          {
            questionId: 1,
            type: 'free_text',
            prompt: 'Q1',
            answer: 'A1',
            points: 1,
          },
        ],
      }),
    ];

    const issues = findLiveEditViolations(current, incoming, []);

    expect(issues).toEqual([
      expect.objectContaining({
        roundIndex: 0,
        questionIndex: null,
        field: 'questions',
      }),
    ]);
  });

  it('rejects reordering questions within a round', () => {
    const current = [round()];
    const incoming = [
      round({
        questions: [
          {
            questionId: 2,
            type: 'free_text',
            prompt: 'Q2',
            answer: 'A2',
            points: 1,
          },
          {
            questionId: 1,
            type: 'free_text',
            prompt: 'Q1',
            answer: 'A1',
            points: 1,
          },
        ],
      }),
    ];

    const issues = findLiveEditViolations(current, incoming, []);

    expect(issues).toEqual([
      expect.objectContaining({
        roundIndex: 0,
        questionIndex: 0,
        field: 'questionId',
      }),
      expect.objectContaining({
        roundIndex: 0,
        questionIndex: 1,
        field: 'questionId',
      }),
    ]);
  });

  it('rejects a brand-new question inserted at an existing position without an id', () => {
    const current = [round()];
    const incoming = [
      round({
        questions: [
          { type: 'free_text', prompt: 'New question', answer: 'A', points: 1 },
          {
            questionId: 2,
            type: 'free_text',
            prompt: 'Q2',
            answer: 'A2',
            points: 1,
          },
        ],
      }),
    ];

    const issues = findLiveEditViolations(current, incoming, []);

    expect(issues).toEqual([
      expect.objectContaining({
        roundIndex: 0,
        questionIndex: 0,
        field: 'questionId',
      }),
    ]);
  });

  it('allows editing an unlocked question freely', () => {
    const current = [round()];
    const incoming = [
      round({
        questions: [
          {
            questionId: 1,
            type: 'free_text',
            prompt: 'Corrected Q1',
            answer: 'Corrected A1',
            points: 5,
          },
          {
            questionId: 2,
            type: 'free_text',
            prompt: 'Q2',
            answer: 'A2',
            points: 1,
          },
        ],
      }),
    ];

    expect(findLiveEditViolations(current, incoming, [])).toEqual([]);
  });

  it('rejects each individually-diffed field on a locked question', () => {
    const current = [round()];
    const incoming = [
      round({
        questions: [
          {
            questionId: 1,
            type: 'free_text',
            prompt: 'Different prompt',
            answer: 'Different answer',
            points: 99,
          },
          {
            questionId: 2,
            type: 'free_text',
            prompt: 'Q2',
            answer: 'A2',
            points: 1,
          },
        ],
      }),
    ];

    const issues = findLiveEditViolations(current, incoming, [1]);

    expect(issues).toEqual([
      expect.objectContaining({
        roundIndex: 0,
        questionIndex: 0,
        field: 'prompt',
      }),
      expect.objectContaining({
        roundIndex: 0,
        questionIndex: 0,
        field: 'answer',
      }),
      expect.objectContaining({
        roundIndex: 0,
        questionIndex: 0,
        field: 'points',
      }),
    ]);
  });

  it('allows editing a question that is unlocked here even if it would be locked elsewhere', () => {
    const current = [round()];
    const incoming = [
      round({
        questions: [
          {
            questionId: 1,
            type: 'free_text',
            prompt: 'Q1',
            answer: 'A1',
            points: 1,
          },
          {
            questionId: 2,
            type: 'free_text',
            prompt: 'Corrected Q2',
            answer: 'A2',
            points: 1,
          },
        ],
      }),
    ];

    expect(findLiveEditViolations(current, incoming, [1])).toEqual([]);
  });
});
