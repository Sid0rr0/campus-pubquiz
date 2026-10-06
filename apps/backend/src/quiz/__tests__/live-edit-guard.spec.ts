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
  hasCurrentBlockStartedLocking = false,
): LiveEditFrontier {
  return {
    openedQuestionIds,
    currentRoundIndex,
    hasCurrentBlockStartedLocking,
  };
}

/** The current round's block has started locking, so the round is frozen whole. */
function lockingFrontier(
  openedQuestionIds: number[] = [],
  currentRoundIndex = 0,
): LiveEditFrontier {
  return frontier(openedQuestionIds, currentRoundIndex, true);
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

  it('rejects removing the current round', () => {
    const current = [round(), round({ title: 'Round 2' })];
    const incoming: ImportRoundPreview[] = [];

    const issues = findLiveEditViolations(current, incoming, frontier());

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      roundIndex: -1,
      questionIndex: null,
      field: 'rounds',
    });
    expect(issues[0].message).toMatch(/reached/i);
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

    const issues = findLiveEditViolations(current, incoming, lockingFrontier());

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

    const issues = findLiveEditViolations(current, incoming, lockingFrontier());

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

    const issues = findLiveEditViolations(current, incoming, lockingFrontier());

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
    /** The current round's block has started locking. */
    isLocking?: boolean;
    /** Opened question ids; defaults to the questions of the rounds before the current one. */
    openedQuestionIds?: number[];
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
      name: 'adds a question to the current round before any of its questions opened',
      currentRoundIndex: 1,
      incoming: [
        roundOf('R0', [question(1), question(2)]),
        roundOf('R1', [question(3), question(4), question(undefined)]),
        roundOf('R2', [question(5), question(6)]),
      ],
      violatingRounds: [],
    },
    {
      name: 'adds a question to the current round once its block has started locking',
      currentRoundIndex: 1,
      isLocking: true,
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
      name: 'reorders questions in the current round before any of its questions opened',
      currentRoundIndex: 1,
      incoming: [
        roundOf('R0', [question(1), question(2)]),
        roundOf('R1', [question(4), question(3)]),
        roundOf('R2', [question(5), question(6)]),
      ],
      violatingRounds: [],
    },
    {
      name: 'reorders questions in the current round once its block has started locking',
      currentRoundIndex: 1,
      isLocking: true,
      incoming: [
        roundOf('R0', [question(1), question(2)]),
        roundOf('R1', [question(4), question(3)]),
        roundOf('R2', [question(5), question(6)]),
      ],
      violatingRounds: [1],
    },
    {
      name: 'moves a question from a later round into the current round before any of its questions opened',
      currentRoundIndex: 1,
      incoming: [
        roundOf('R0', [question(1), question(2)]),
        roundOf('R1', [question(3), question(4), question(5)]),
        roundOf('R2', [question(6)]),
      ],
      violatingRounds: [],
    },
    {
      name: 'moves a question from a later round into the current round once its block has started locking',
      currentRoundIndex: 1,
      isLocking: true,
      incoming: [
        roundOf('R0', [question(1), question(2)]),
        roundOf('R1', [question(3), question(4), question(5)]),
        roundOf('R2', [question(6)]),
      ],
      violatingRounds: [1],
    },
    {
      name: 'moves a question out of the current round before any of its questions opened',
      currentRoundIndex: 1,
      incoming: [
        roundOf('R0', [question(1), question(2)]),
        roundOf('R1', [question(3)]),
        roundOf('R2', [question(4), question(5), question(6)]),
      ],
      violatingRounds: [],
    },
    {
      name: 'moves a question out of the current round once its block has started locking',
      currentRoundIndex: 1,
      isLocking: true,
      incoming: [
        roundOf('R0', [question(1), question(2)]),
        roundOf('R1', [question(3)]),
        roundOf('R2', [question(4), question(5), question(6)]),
      ],
      violatingRounds: [1],
    },
    {
      name: 'reorders a round another session has since opened a question in',
      currentRoundIndex: 2,
      openedQuestionIds: [1, 2, 5],
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
    ({
      currentRoundIndex,
      isLocking = false,
      openedQuestionIds = [1, 2],
      incoming,
      violatingRounds,
    }) => {
      const issues = findLiveEditViolations(
        current(),
        incoming,
        frontier(openedQuestionIds, currentRoundIndex, isLocking),
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
        roundOf('R0', [question(1)]),
        roundOf('R1', [question(3), question(4)]),
        roundOf('R2', [question(5), question(6)]),
      ],
      frontier([1, 2], 2),
    );

    expect(issues[0].message).toMatch(/reached/i);
  });

  it('tells the quiz master to use a later round once the current block has started locking', () => {
    const issues = findLiveEditViolations(
      current(),
      [
        roundOf('R0', [question(1), question(2)]),
        roundOf('R1', [question(3), question(4)]),
        roundOf('R2', [question(5), question(6), question(undefined)]),
      ],
      lockingFrontier([1, 2, 5], 2),
    );

    expect(issues[0].message).toMatch(/locking.*later round/i);
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

describe('findLiveEditViolations — rounds after the current round', () => {
  const current = () => [
    roundOf('R0', [question(1), question(2)]),
    roundOf('R1', [question(3), question(4)]),
    { ...roundOf('R2', [question(5), question(6)]), breakAfter: true },
  ];
  const r0 = () => current()[0];
  const r1 = () => current()[1];
  const r2 = () => current()[2];

  type Case = {
    name: string;
    currentRoundIndex: number;
    isLocking?: boolean;
    openedQuestionIds?: number[];
    incoming: ImportRoundPreview[];
    violations: { roundIndex: number; field: string }[];
  };

  const cases: Case[] = [
    {
      name: 'adds a round at the end',
      currentRoundIndex: 0,
      incoming: [r0(), r1(), r2(), roundOf('R3', [question(undefined)])],
      violations: [],
    },
    {
      name: 'adds a round between later rounds',
      currentRoundIndex: 0,
      incoming: [r0(), r1(), roundOf('New', [question(undefined)]), r2()],
      violations: [],
    },
    {
      name: 'deletes a later round',
      currentRoundIndex: 0,
      incoming: [r0(), r2()],
      violations: [],
    },
    {
      name: 'reorders later rounds',
      currentRoundIndex: 0,
      incoming: [r0(), r2(), r1()],
      violations: [],
    },
    {
      name: "turns on a later round's break-after, moving where the current block ends",
      currentRoundIndex: 0,
      incoming: [r0(), { ...r1(), breakAfter: true }, r2()],
      violations: [],
    },
    {
      name: "changes a later round's kahoot setting",
      currentRoundIndex: 0,
      incoming: [r0(), { ...r1(), kahootMode: true }, r2()],
      violations: [],
    },
    {
      name: 'moves an earlier round down past the current round',
      currentRoundIndex: 1,
      openedQuestionIds: [1, 2],
      incoming: [r1(), r0(), r2()],
      violations: [
        { roundIndex: 0, field: 'questionId' },
        { roundIndex: 0, field: 'questionId' },
      ],
    },
    {
      name: 'deletes the current round',
      currentRoundIndex: 1,
      openedQuestionIds: [1, 2],
      incoming: [r0()],
      violations: [{ roundIndex: -1, field: 'rounds' }],
    },
    {
      name: "changes the current round's break-after",
      currentRoundIndex: 1,
      openedQuestionIds: [1, 2],
      incoming: [r0(), { ...r1(), breakAfter: true }, r2()],
      violations: [{ roundIndex: 1, field: 'breakAfter' }],
    },
    {
      name: "changes the current round's kahoot setting",
      currentRoundIndex: 1,
      openedQuestionIds: [1, 2],
      incoming: [r0(), { ...r1(), kahootMode: true }, r2()],
      violations: [{ roundIndex: 1, field: 'kahootMode' }],
    },
    {
      name: "changes an earlier round's break-after",
      currentRoundIndex: 1,
      openedQuestionIds: [1, 2],
      incoming: [{ ...r0(), breakAfter: true }, r1(), r2()],
      violations: [{ roundIndex: 0, field: 'breakAfter' }],
    },
    {
      name: "changes an earlier round's kahoot setting",
      currentRoundIndex: 1,
      openedQuestionIds: [1, 2],
      incoming: [{ ...r0(), kahootMode: true }, r1(), r2()],
      violations: [{ roundIndex: 0, field: 'kahootMode' }],
    },
    {
      name: 'inserts a round before a current round that has opened questions',
      currentRoundIndex: 1,
      openedQuestionIds: [1, 2, 3],
      incoming: [r0(), roundOf('New', [question(undefined)]), r1(), r2()],
      violations: [{ roundIndex: 1, field: 'questionId' }],
    },
    {
      name: 'deletes every round after the current one, which then ends the quiz',
      currentRoundIndex: 1,
      openedQuestionIds: [1, 2],
      incoming: [r0(), r1()],
      violations: [],
    },
    {
      name: 'appends a round after the last round, the current one',
      currentRoundIndex: 2,
      openedQuestionIds: [1, 2, 3, 4, 5],
      incoming: [r0(), r1(), r2(), roundOf('R3', [question(undefined)])],
      violations: [],
    },
    {
      name: 'changes a later round beside a locking current block',
      currentRoundIndex: 0,
      isLocking: true,
      openedQuestionIds: [1, 2],
      incoming: [r0(), { ...r1(), kahootMode: true }, r2()],
      violations: [],
    },
  ];

  it.each(cases)(
    '$name',
    ({
      currentRoundIndex,
      isLocking = false,
      openedQuestionIds = [],
      incoming,
      violations,
    }) => {
      const issues = findLiveEditViolations(
        current(),
        incoming,
        frontier(openedQuestionIds, currentRoundIndex, isLocking),
      );

      expect(
        issues.map(({ roundIndex, field }) => ({ roundIndex, field })),
      ).toEqual(violations);
    },
  );
});

describe('findLiveEditViolations — the current round after its opened questions', () => {
  const current = () => [
    roundOf('R0', [question(1), question(2)]),
    roundOf('R1', [question(3), question(4), question(5), question(6)]),
    roundOf('R2', [question(7), question(8)]),
  ];
  const openedQuestionIds = [1, 2, 3, 4];

  type Case = {
    name: string;
    isLocking?: boolean;
    incoming: ImportRoundPreview[];
    violatingRounds: number[];
  };

  const r0 = roundOf('R0', [question(1), question(2)]);
  const cases: Case[] = [
    {
      name: 'adds a question after the last opened one',
      incoming: [
        r0,
        roundOf('R1', [
          question(3),
          question(4),
          question(5),
          question(6),
          question(undefined),
        ]),
        roundOf('R2', [question(7), question(8)]),
      ],
      violatingRounds: [],
    },
    {
      name: 'inserts a question right after the last opened one',
      incoming: [
        r0,
        roundOf('R1', [
          question(3),
          question(4),
          question(undefined),
          question(5),
          question(6),
        ]),
        roundOf('R2', [question(7), question(8)]),
      ],
      violatingRounds: [],
    },
    {
      name: 'reorders the unopened questions',
      incoming: [
        r0,
        roundOf('R1', [question(3), question(4), question(6), question(5)]),
        roundOf('R2', [question(7), question(8)]),
      ],
      violatingRounds: [],
    },
    {
      name: 'deletes an unopened question',
      incoming: [
        r0,
        roundOf('R1', [question(3), question(4), question(5)]),
        roundOf('R2', [question(7), question(8)]),
      ],
      violatingRounds: [],
    },
    {
      name: 'moves an unopened question to a later round',
      incoming: [
        r0,
        roundOf('R1', [question(3), question(4), question(5)]),
        roundOf('R2', [question(7), question(8), question(6)]),
      ],
      violatingRounds: [],
    },
    {
      name: 'moves a question from a later round in after the opened ones',
      incoming: [
        r0,
        roundOf('R1', [
          question(3),
          question(4),
          question(5),
          question(6),
          question(7),
        ]),
        roundOf('R2', [question(8)]),
      ],
      violatingRounds: [],
    },
    {
      name: 'inserts a question before the opened ones',
      incoming: [
        r0,
        roundOf('R1', [
          question(undefined),
          question(3),
          question(4),
          question(5),
          question(6),
        ]),
        roundOf('R2', [question(7), question(8)]),
      ],
      violatingRounds: [1],
    },
    {
      name: 'inserts a question between opened ones',
      incoming: [
        r0,
        roundOf('R1', [
          question(3),
          question(undefined),
          question(4),
          question(5),
          question(6),
        ]),
        roundOf('R2', [question(7), question(8)]),
      ],
      violatingRounds: [1],
    },
    {
      name: 'reorders opened questions',
      incoming: [
        r0,
        roundOf('R1', [question(4), question(3), question(5), question(6)]),
        roundOf('R2', [question(7), question(8)]),
      ],
      violatingRounds: [1],
    },
    {
      name: 'swaps an opened question with an unopened one',
      incoming: [
        r0,
        roundOf('R1', [question(3), question(5), question(4), question(6)]),
        roundOf('R2', [question(7), question(8)]),
      ],
      violatingRounds: [1],
    },
    {
      name: 'deletes an opened question',
      incoming: [
        r0,
        roundOf('R1', [question(3), question(5), question(6)]),
        roundOf('R2', [question(7), question(8)]),
      ],
      violatingRounds: [1],
    },
    {
      name: 'deletes the last opened question',
      incoming: [
        r0,
        roundOf('R1', [question(3)]),
        roundOf('R2', [question(7), question(8)]),
      ],
      violatingRounds: [1],
    },
    {
      name: 'moves an opened question to a later round',
      incoming: [
        r0,
        roundOf('R1', [question(3), question(5), question(6)]),
        roundOf('R2', [question(7), question(8), question(4)]),
      ],
      violatingRounds: [1],
    },
    {
      name: 'adds a question after the opened ones once the block has started locking',
      isLocking: true,
      incoming: [
        r0,
        roundOf('R1', [
          question(3),
          question(4),
          question(5),
          question(6),
          question(undefined),
        ]),
        roundOf('R2', [question(7), question(8)]),
      ],
      violatingRounds: [1],
    },
    {
      name: 'deletes an unopened question once the block has started locking',
      isLocking: true,
      incoming: [
        r0,
        roundOf('R1', [question(3), question(4), question(5)]),
        roundOf('R2', [question(7), question(8)]),
      ],
      violatingRounds: [1],
    },
    {
      name: 'reorders unopened questions once the block has started locking',
      isLocking: true,
      incoming: [
        r0,
        roundOf('R1', [question(3), question(4), question(6), question(5)]),
        roundOf('R2', [question(7), question(8)]),
      ],
      violatingRounds: [1],
    },
    {
      name: 'moves an unopened question to a later round once the block has started locking',
      isLocking: true,
      incoming: [
        r0,
        roundOf('R1', [question(3), question(4), question(5)]),
        roundOf('R2', [question(7), question(8), question(6)]),
      ],
      violatingRounds: [1],
    },
    {
      name: 'adds a question to a later round once the block has started locking',
      isLocking: true,
      incoming: [
        r0,
        roundOf('R1', [question(3), question(4), question(5), question(6)]),
        roundOf('R2', [question(7), question(8), question(undefined)]),
      ],
      violatingRounds: [],
    },
  ];

  it.each(cases)(
    '$name',
    ({ isLocking = false, incoming, violatingRounds }) => {
      const issues = findLiveEditViolations(
        current(),
        incoming,
        frontier(openedQuestionIds, 1, isLocking),
      );

      expect([...new Set(issues.map((issue) => issue.roundIndex))]).toEqual(
        violatingRounds,
      );
    },
  );

  it('says to add after the last opened question when one is inserted before it', () => {
    const issues = findLiveEditViolations(
      current(),
      [
        r0,
        roundOf('R1', [
          question(undefined),
          question(3),
          question(4),
          question(5),
          question(6),
        ]),
        roundOf('R2', [question(7), question(8)]),
      ],
      frontier(openedQuestionIds, 1),
    );

    expect(issues[0].message).toMatch(/after the last opened/i);
  });

  it('keeps an opened question in the round fixable in place beside an unopened-question edit', () => {
    const issues = findLiveEditViolations(
      current(),
      [
        r0,
        roundOf('R1', [
          question(3, { prompt: 'Fixed' }),
          question(4),
          question(6),
          question(5),
        ]),
        roundOf('R2', [question(7), question(8)]),
      ],
      frontier(openedQuestionIds, 1),
    );

    expect(issues).toEqual([]);
  });

  it('still refuses changing the type of an opened question in the round', () => {
    const issues = findLiveEditViolations(
      current(),
      [
        r0,
        roundOf('R1', [
          question(3, { type: 'multiple_choice', options: ['a', 'b'] }),
          question(4),
          question(5),
          question(6),
        ]),
        roundOf('R2', [question(7), question(8)]),
      ],
      frontier(openedQuestionIds, 1),
    );

    expect(issues.map((issue) => issue.field)).toContain('type');
  });

  it('allows any change in a current round with no opened questions yet', () => {
    const issues = findLiveEditViolations(
      current(),
      [
        r0,
        roundOf('R1', [question(6), question(undefined), question(3)]),
        roundOf('R2', [question(7), question(8), question(4), question(5)]),
      ],
      frontier([1, 2], 1),
    );

    expect(issues).toEqual([]);
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
