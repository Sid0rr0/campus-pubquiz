import type { ImportRoundPreview } from '@campus-pubquiz/types';
import {
  findLiveEditViolations,
  findRegradeQuestionIds,
} from '@/quiz/live-edit-guard';

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

  it("rejects changing a round's breakAfter", () => {
    const current = [round(), round({ title: 'Round 2' })];
    const incoming = [round({ breakAfter: true }), round({ title: 'Round 2' })];

    const issues = findLiveEditViolations(current, incoming, []);

    expect(issues).toEqual([
      expect.objectContaining({
        roundIndex: 0,
        questionIndex: null,
        field: 'breakAfter',
      }),
    ]);
  });

  it("ignores the last round's breakAfter, which is always forced on at save", () => {
    const current = [round({ breakAfter: true })];
    const incoming = [round({ breakAfter: false })];

    expect(findLiveEditViolations(current, incoming, [])).toEqual([]);
  });

  it("rejects changing a round's kahootMode", () => {
    const current = [round()];
    const incoming = [round({ kahootMode: true })];

    const issues = findLiveEditViolations(current, incoming, []);

    expect(issues).toEqual([
      expect.objectContaining({
        roundIndex: 0,
        questionIndex: null,
        field: 'kahootMode',
      }),
    ]);
  });

  it('treats an unset kahootMode as false', () => {
    const current = [round({ kahootMode: false })];
    const incoming = [round({ kahootMode: undefined })];

    expect(findLiveEditViolations(current, incoming, [])).toEqual([]);
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

  it('allows editing an unopened question freely', () => {
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

  it('allows fixing the prompt, answer, points, notes and media of an opened question', () => {
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
            notes: 'accept spelling variants',
            mediaUrl: 'https://example.com/q1.png',
            answerMediaUrl: 'https://example.com/a1.png',
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

    expect(findLiveEditViolations(current, incoming, [1])).toEqual([]);
  });

  it('rejects changing the type or choices of an opened question', () => {
    const current = [
      round({
        questions: [
          {
            questionId: 1,
            type: 'match',
            prompt: 'Match them',
            answer: 'x|y',
            points: 2,
            options: ['a', 'b'],
            matchTargets: ['y', 'x'],
          },
        ],
      }),
    ];
    const incoming = [
      round({
        questions: [
          {
            questionId: 1,
            type: 'sort',
            prompt: 'Match them',
            answer: 'x|y',
            points: 2,
            options: ['a', 'c'],
            matchTargets: ['y', 'z'],
          },
        ],
      }),
    ];

    const issues = findLiveEditViolations(current, incoming, [1]);

    expect(issues.map((issue) => issue.field)).toEqual([
      'type',
      'options',
      'matchTargets',
    ]);
    expect(issues[0]).toEqual(
      expect.objectContaining({ roundIndex: 0, questionIndex: 0 }),
    );
  });

  it('allows editing a question that is unopened here even if it would be opened elsewhere', () => {
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

describe('findRegradeQuestionIds', () => {
  function withFirstQuestion(
    overrides: Partial<ImportRoundPreview['questions'][number]>,
  ): ImportRoundPreview[] {
    const base = round();
    return [
      {
        ...base,
        questions: [{ ...base.questions[0], ...overrides }, base.questions[1]],
      },
    ];
  }

  it('returns an opened question whose answer changed', () => {
    expect(
      findRegradeQuestionIds(
        [round()],
        withFirstQuestion({ answer: 'B' }),
        [1],
      ),
    ).toEqual([1]);
  });

  it('returns an opened question whose points changed', () => {
    expect(
      findRegradeQuestionIds([round()], withFirstQuestion({ points: 3 }), [1]),
    ).toEqual([1]);
  });

  it('returns an opened question whose matchScoringMode changed', () => {
    expect(
      findRegradeQuestionIds(
        [round()],
        withFirstQuestion({ matchScoringMode: 'all_or_nothing' }),
        [1],
      ),
    ).toEqual([1]);
  });

  it('ignores an opened question whose grading inputs are unchanged', () => {
    expect(
      findRegradeQuestionIds(
        [round()],
        withFirstQuestion({ prompt: 'Typo fixed' }),
        [1],
      ),
    ).toEqual([]);
  });

  it('ignores an unopened question even if its answer changed', () => {
    expect(
      findRegradeQuestionIds([round()], withFirstQuestion({ answer: 'B' }), []),
    ).toEqual([]);
  });
});
