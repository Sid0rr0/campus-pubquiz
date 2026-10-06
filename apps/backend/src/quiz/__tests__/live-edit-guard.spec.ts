import type {
  ImportQuestionPreview,
  ImportRoundPreview,
  LiveEditFrontier,
} from '@campus-pubquiz/types';
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

function frontier(
  openedQuestionIds: number[] = [],
  currentRoundIndex = 0,
): LiveEditFrontier {
  return { openedQuestionIds, currentRoundIndex };
}

function question(
  questionId: number | undefined,
  overrides: Partial<ImportQuestionPreview> = {},
): ImportQuestionPreview {
  return {
    ...(questionId === undefined ? {} : { questionId }),
    type: 'free_text',
    prompt: `Q${questionId ?? 'new'}`,
    answer: 'A',
    points: 1,
    ...overrides,
  };
}

function roundOf(
  title: string,
  questions: ImportQuestionPreview[],
): ImportRoundPreview {
  return { title, breakAfter: false, questions };
}

describe('findLiveEditViolations', () => {
  it('returns no issues when nothing changed', () => {
    const rounds = [round()];
    expect(findLiveEditViolations(rounds, rounds, frontier())).toEqual([]);
  });

  it('rejects adding or removing a round', () => {
    const current = [round()];
    const incoming = [round(), round({ title: 'Round 2' })];

    const issues = findLiveEditViolations(current, incoming, frontier());

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

    const issues = findLiveEditViolations(current, incoming, frontier());

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

    expect(findLiveEditViolations(current, incoming, frontier())).toEqual([]);
  });

  it("rejects changing a round's kahootMode", () => {
    const current = [round()];
    const incoming = [round({ kahootMode: true })];

    const issues = findLiveEditViolations(current, incoming, frontier());

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

    expect(findLiveEditViolations(current, incoming, frontier())).toEqual([]);
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

    const issues = findLiveEditViolations(current, incoming, frontier());

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

    const issues = findLiveEditViolations(current, incoming, frontier());

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

    const issues = findLiveEditViolations(current, incoming, frontier());

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

    expect(findLiveEditViolations(current, incoming, frontier())).toEqual([]);
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

    expect(findLiveEditViolations(current, incoming, frontier([1]))).toEqual(
      [],
    );
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

    const issues = findLiveEditViolations(current, incoming, frontier([1]));

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

    expect(findLiveEditViolations(current, incoming, frontier([1]))).toEqual(
      [],
    );
  });
});

describe('findLiveEditViolations — questions in rounds after the current round', () => {
  const current = () => [
    roundOf('R0', [question(1), question(2)]),
    roundOf('R1', [question(3), question(4)]),
    roundOf('R2', [question(5), question(6)]),
  ];

  type Case = {
    name: string;
    currentRoundIndex: number;
    incoming: ImportRoundPreview[];
    violatingRounds: number[];
  };

  const cases: Case[] = [
    {
      name: 'adds a question to a later round',
      currentRoundIndex: 0,
      incoming: [
        roundOf('R0', [question(1), question(2)]),
        roundOf('R1', [question(3), question(4), question(undefined)]),
        roundOf('R2', [question(5), question(6)]),
      ],
      violatingRounds: [],
    },
    {
      name: 'reorders questions in a later round',
      currentRoundIndex: 0,
      incoming: [
        roundOf('R0', [question(1), question(2)]),
        roundOf('R1', [question(4), question(3)]),
        roundOf('R2', [question(5), question(6)]),
      ],
      violatingRounds: [],
    },
    {
      name: 'deletes a question from a later round',
      currentRoundIndex: 0,
      incoming: [
        roundOf('R0', [question(1), question(2)]),
        roundOf('R1', [question(3)]),
        roundOf('R2', [question(5), question(6)]),
      ],
      violatingRounds: [],
    },
    {
      name: 'moves a question between two later rounds',
      currentRoundIndex: 0,
      incoming: [
        roundOf('R0', [question(1), question(2)]),
        roundOf('R1', [question(3)]),
        roundOf('R2', [question(4), question(5), question(6)]),
      ],
      violatingRounds: [],
    },
    {
      name: 'adds a question to the current round',
      currentRoundIndex: 1,
      incoming: [
        roundOf('R0', [question(1), question(2)]),
        roundOf('R1', [question(3), question(4), question(undefined)]),
        roundOf('R2', [question(5), question(6)]),
      ],
      violatingRounds: [1],
    },
    {
      name: 'deletes a question from an earlier round',
      currentRoundIndex: 1,
      incoming: [
        roundOf('R0', [question(1)]),
        roundOf('R1', [question(3), question(4)]),
        roundOf('R2', [question(5), question(6)]),
      ],
      violatingRounds: [0],
    },
    {
      name: 'reorders questions in the current round',
      currentRoundIndex: 1,
      incoming: [
        roundOf('R0', [question(1), question(2)]),
        roundOf('R1', [question(4), question(3)]),
        roundOf('R2', [question(5), question(6)]),
      ],
      violatingRounds: [1],
    },
    {
      name: 'moves a question from a later round into the current round',
      currentRoundIndex: 1,
      incoming: [
        roundOf('R0', [question(1), question(2)]),
        roundOf('R1', [question(3), question(4), question(5)]),
        roundOf('R2', [question(6)]),
      ],
      violatingRounds: [1],
    },
    {
      name: 'moves a question out of the current round into a later one',
      currentRoundIndex: 1,
      incoming: [
        roundOf('R0', [question(1), question(2)]),
        roundOf('R1', [question(3)]),
        roundOf('R2', [question(4), question(5), question(6)]),
      ],
      violatingRounds: [1],
    },
    {
      name: 'edits a round another session has already reached since the editor loaded',
      currentRoundIndex: 2,
      incoming: [
        roundOf('R0', [question(1), question(2)]),
        roundOf('R1', [question(3), question(4)]),
        roundOf('R2', [question(6), question(5)]),
      ],
      violatingRounds: [2],
    },
  ];

  it.each(cases)(
    '$name',
    ({ currentRoundIndex, incoming, violatingRounds }) => {
      const issues = findLiveEditViolations(
        current(),
        incoming,
        frontier([1, 2], currentRoundIndex),
      );

      expect([...new Set(issues.map((issue) => issue.roundIndex))]).toEqual(
        violatingRounds,
      );
    },
  );

  it('names the conflict when a round was reached since the editor loaded', () => {
    const issues = findLiveEditViolations(
      current(),
      [
        roundOf('R0', [question(1), question(2)]),
        roundOf('R1', [question(3), question(4)]),
        roundOf('R2', [question(5)]),
      ],
      frontier([1, 2], 2),
    );

    expect(issues[0].message).toMatch(/reached/i);
  });

  it('lets an opened question keep being fixed in place beside a later-round edit', () => {
    const incoming = [
      roundOf('R0', [question(1, { prompt: 'Fixed' }), question(2)]),
      roundOf('R1', [question(4), question(3)]),
      roundOf('R2', [question(5), question(6)]),
    ];

    expect(
      findLiveEditViolations(current(), incoming, frontier([1, 2], 0)),
    ).toEqual([]);
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
