import { describe, expect, it } from 'vitest';
import type {
  ImportQuestionPreview,
  ImportRoundPreview,
  LiveEditFrontier,
} from '@campus-pubquiz/types';
import {
  getPinnedQuestionCount,
  makeMatchPair,
  makeOption,
  makeQuestion,
  makeRound,
  mergeRoundsFromPreview,
  moveQuestionToRound,
  questionFromPreview,
  questionToPreview,
  roundFromPreview,
  toSaveRequest,
  withSyncedQuestionIds,
} from '@/app/quizzes/[id]/quiz-draft-state';

describe('makeQuestion / makeRound', () => {
  it('creates a blank multiple choice question with two empty options', () => {
    const question = makeQuestion('q1');

    expect(question).toEqual({
      id: 'q1',
      type: 'multiple_choice',
      prompt: '',
      points: 1,
      notes: '',
      options: [makeOption(), makeOption()],
      sortItems: ['', ''],
      matchPairs: [makeMatchPair(), makeMatchPair()],
      matchScoringMode: 'partial',
      correctText: '',
      mediaUrl: '',
      answerMediaUrl: '',
    });
  });

  it('defaults a kahoot round question to 1000 points', () => {
    const question = makeQuestion('q1', true);

    expect(question.points).toBe(1000);
  });

  it('creates a blank round with no questions', () => {
    expect(makeRound('r1', 'Round 1')).toEqual({
      id: 'r1',
      title: 'Round 1',
      breakAfter: false,
      kahootMode: false,
      category: '',
      author: '',
      questions: [],
    });
  });
});

describe('questionFromPreview / questionToPreview round-trip', () => {
  it('marks the matching option correct for a multiple choice question', () => {
    const preview: ImportQuestionPreview = {
      type: 'multiple_choice',
      prompt: 'Capital of France?',
      answer: 'Paris',
      points: 3,
      options: ['Paris', 'London', 'Berlin'],
    };

    const question = questionFromPreview('q1', preview);

    expect(question.options).toEqual([
      { text: 'Paris', isCorrect: true },
      { text: 'London', isCorrect: false },
      { text: 'Berlin', isCorrect: false },
    ]);
    expect(questionToPreview(question)).toEqual(preview);
  });

  it.each(['audio', 'youtube'] as const)(
    'round-trips a %s question with choices and one without',
    (type) => {
      const mediaUrl =
        type === 'audio'
          ? 'https://example.com/clip.mp3'
          : 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      const withChoices: ImportQuestionPreview = {
        type,
        prompt: 'Which one?',
        answer: 'B',
        points: 1,
        mediaUrl,
        options: ['A', 'B'],
      };
      const withoutChoices: ImportQuestionPreview = {
        type,
        prompt: 'Which one?',
        answer: 'B',
        points: 1,
        mediaUrl,
      };

      const editable = questionFromPreview('q1', withChoices);

      expect(editable.options[1]).toEqual({ text: 'B', isCorrect: true });
      expect(questionToPreview(editable)).toEqual(withChoices);
      expect(
        questionToPreview(questionFromPreview('q2', withoutChoices)),
      ).toEqual(withoutChoices);
    },
  );

  it('saves an audio question whose choices were all cleared as a typed answer', () => {
    const editable = {
      ...questionFromPreview('q1', {
        type: 'audio',
        prompt: 'Which one?',
        answer: 'B',
        points: 1,
        mediaUrl: 'https://example.com/clip.mp3',
        options: ['A', 'B'],
      }),
    };
    const cleared = {
      ...editable,
      options: editable.options.map((option) => ({ ...option, text: '' })),
      correctText: ' B ',
    };

    const preview = questionToPreview(cleared);

    expect(preview.answer).toBe('B');
    expect(preview).not.toHaveProperty('options');
  });

  it('loads an audio question whose choices are all blank as a typed answer', () => {
    const editable = questionFromPreview('q1', {
      type: 'audio',
      prompt: 'Which one?',
      answer: 'B',
      points: 1,
      mediaUrl: 'https://example.com/clip.mp3',
      options: ['', ''],
    });

    expect(editable.correctText).toBe('B');
  });

  it('carries notes and media urls through for a question with an image mediaUrl', () => {
    const preview: ImportQuestionPreview = {
      type: 'free_text',
      prompt: 'Name this landmark.',
      answer: 'Eiffel Tower',
      points: 2,
      notes: 'Zoom in on the top',
      mediaUrl: 'https://example.com/eiffel.jpg',
      answerMediaUrl: 'https://example.com/eiffel-answer.jpg',
    };

    const question = questionFromPreview('q1', preview);

    expect(question.correctText).toBe('Eiffel Tower');
    expect(question.mediaUrl).toBe('https://example.com/eiffel.jpg');
    expect(questionToPreview(question)).toEqual(preview);
  });

  it('derives the answer from whichever option is marked correct', () => {
    const question = makeQuestion('q1');
    question.prompt = 'Capital of France?';
    question.options = [
      { text: 'Paris', isCorrect: false },
      { text: 'London', isCorrect: true },
    ];

    expect(questionToPreview(question).answer).toBe('London');
  });

  it('drops blank options and trims text when converting back to a preview', () => {
    const question = makeQuestion('q1');
    question.prompt = ' Capital of France? ';
    question.options = [
      { text: ' Paris ', isCorrect: true },
      { text: '  ', isCorrect: false },
    ];

    const preview = questionToPreview(question);

    expect(preview.prompt).toBe('Capital of France?');
    expect(preview.options).toEqual(['Paris']);
    expect(preview.answer).toBe('Paris');
  });

  it('reconstructs sortItems in correct order from a saved sort question', () => {
    const preview: ImportQuestionPreview = {
      type: 'sort',
      prompt: 'Order these planets from the sun outward.',
      answer: 'Mercury|Venus|Earth',
      points: 3,
      options: ['Venus', 'Mercury', 'Earth'],
    };

    const question = questionFromPreview('q1', preview);

    expect(question.sortItems).toEqual(['Mercury', 'Venus', 'Earth']);
    expect(question.correctText).toBe('');
  });

  it('re-derives a sort answer from sortItems and keeps the option set unchanged (display order may reshuffle)', () => {
    const question = makeQuestion('q1');
    question.type = 'sort';
    question.prompt = 'Order these planets from the sun outward.';
    question.points = 3;
    question.sortItems = ['Mercury', 'Venus', 'Earth'];

    const preview = questionToPreview(question);

    expect(preview.answer).toBe('Mercury|Venus|Earth');
    expect(preview.options).toBeDefined();
    expect([...(preview.options ?? [])].sort()).toEqual([
      'Earth',
      'Mercury',
      'Venus',
    ]);
  });

  it('reconstructs matchPairs from a saved match question, zipping options with the positional answer', () => {
    const preview: ImportQuestionPreview = {
      type: 'match',
      prompt: 'Match the hero to their weapon.',
      answer: 'excalibur|shield',
      points: 4,
      options: ['arthur', 'captain america'],
      matchTargets: ['shield', 'excalibur'],
    };

    const question = questionFromPreview('q1', preview);

    expect(question.matchPairs).toEqual([
      { left: 'arthur', right: 'excalibur' },
      { left: 'captain america', right: 'shield' },
    ]);
  });

  it('derives a positionally-canonical match answer from matchPairs, keeping options as the entered left order', () => {
    const question = makeQuestion('q1');
    question.type = 'match';
    question.prompt = 'Match the hero to their weapon.';
    question.points = 4;
    question.matchPairs = [
      { left: 'arthur', right: 'excalibur' },
      { left: 'captain america', right: 'shield' },
    ];

    const preview = questionToPreview(question);

    expect(preview.answer).toBe('excalibur|shield');
    expect(preview.options).toEqual(['arthur', 'captain america']);
    expect([...(preview.matchTargets ?? [])].sort()).toEqual([
      'excalibur',
      'shield',
    ]);
  });

  it('keeps a saved sort question’s display order when its items are unchanged, even if the correct order changes', () => {
    const loaded = questionFromPreview('q1', {
      questionId: 7,
      type: 'sort',
      prompt: 'Order these planets from the sun outward.',
      answer: 'Mercury|Venus|Earth',
      points: 3,
      options: ['Venus', 'Earth', 'Mercury'],
    });

    const saved = questionToPreview({
      ...loaded,
      sortItems: ['Venus', 'Mercury', 'Earth'],
    });

    expect(saved.options).toEqual(['Venus', 'Earth', 'Mercury']);
    expect(saved.answer).toBe('Venus|Mercury|Earth');
  });

  it('reshuffles a saved sort question once its item set changes', () => {
    const loaded = questionFromPreview('q1', {
      type: 'sort',
      prompt: 'Order these planets from the sun outward.',
      answer: 'Mercury|Venus|Earth',
      points: 3,
      options: ['Venus', 'Earth', 'Mercury'],
    });

    const saved = questionToPreview({
      ...loaded,
      sortItems: ['Mercury', 'Venus', 'Mars'],
    });

    expect([...(saved.options ?? [])].sort()).toEqual([
      'Mars',
      'Mercury',
      'Venus',
    ]);
  });

  it('defaults matchScoringMode to partial when a saved match question has none', () => {
    const preview: ImportQuestionPreview = {
      type: 'match',
      prompt: 'Match the hero to their weapon.',
      answer: 'excalibur|shield',
      points: 4,
      options: ['arthur', 'captain america'],
      matchTargets: ['shield', 'excalibur'],
    };

    const question = questionFromPreview('q1', preview);

    expect(question.matchScoringMode).toBe('partial');
  });

  it('round-trips an explicit matchScoringMode through questionFromPreview/questionToPreview', () => {
    const preview: ImportQuestionPreview = {
      type: 'match',
      prompt: 'Match the hero to their weapon.',
      answer: 'excalibur|shield',
      points: 4,
      options: ['arthur', 'captain america'],
      matchTargets: ['shield', 'excalibur'],
      matchScoringMode: 'all_or_nothing',
    };

    const question = questionFromPreview('q1', preview);
    expect(question.matchScoringMode).toBe('all_or_nothing');

    const saved = questionToPreview(question);
    expect(saved.matchScoringMode).toBe('all_or_nothing');
  });

  it('keeps a saved match question’s target order when its right-hand items are unchanged, even if re-paired', () => {
    const loaded = questionFromPreview('q1', {
      type: 'match',
      prompt: 'Match the hero to their weapon.',
      answer: 'excalibur|shield|hammer',
      points: 3,
      options: ['arthur', 'captain america', 'thor'],
      matchTargets: ['hammer', 'excalibur', 'shield'],
    });

    const saved = questionToPreview({
      ...loaded,
      matchPairs: [
        { left: 'arthur', right: 'excalibur' },
        { left: 'captain america', right: 'hammer' },
        { left: 'thor', right: 'shield' },
      ],
    });

    expect(saved.matchTargets).toEqual(['hammer', 'excalibur', 'shield']);
    expect(saved.answer).toBe('excalibur|hammer|shield');
  });

  it('omits notes/mediaUrl/answerMediaUrl when left blank', () => {
    const question = makeQuestion('q1');
    question.prompt = 'Largest planet?';
    question.type = 'free_text';
    question.correctText = 'Jupiter';

    const preview = questionToPreview(question);

    expect(preview).not.toHaveProperty('notes');
    expect(preview).not.toHaveProperty('mediaUrl');
    expect(preview).not.toHaveProperty('answerMediaUrl');
    expect(preview).not.toHaveProperty('options');
  });
});

describe('questionToPreview after a type change', () => {
  function staleQuestion(type: ImportQuestionPreview['type']) {
    const question = makeQuestion('q1');
    question.prompt = 'Anything?';
    question.options = [
      { text: 'Paris', isCorrect: true },
      { text: 'Rome', isCorrect: false },
    ];
    question.sortItems = ['a', 'b'];
    question.matchPairs = [makeMatchPair('x', '1'), makeMatchPair('y', '2')];
    question.correctText = '42';
    question.type = type;
    return questionToPreview(question);
  }

  it.each(['free_text', 'closest_guess'] as const)(
    'drops options and pairs, keeping the typed answer, for %s',
    (type) => {
      const preview = staleQuestion(type);

      expect(preview).not.toHaveProperty('options');
      expect(preview).not.toHaveProperty('matchTargets');
      expect(preview).not.toHaveProperty('matchScoringMode');
      expect(preview.answer).toBe('42');
    },
  );

  it.each(['audio', 'youtube'] as const)(
    'keeps the choices already entered, as optional choices, for %s',
    (type) => {
      const preview = staleQuestion(type);

      expect(preview.options).toEqual(['Paris', 'Rome']);
      expect(preview.answer).toBe('Paris');
      expect(preview).not.toHaveProperty('matchTargets');
    },
  );

  it('keeps only the multiple choice fields for multiple_choice', () => {
    const preview = staleQuestion('multiple_choice');

    expect(preview.options).toEqual(['Paris', 'Rome']);
    expect(preview.answer).toBe('Paris');
    expect(preview).not.toHaveProperty('matchTargets');
  });

  it('keeps only the sort fields for sort', () => {
    const preview = staleQuestion('sort');

    expect([...(preview.options ?? [])].sort()).toEqual(['a', 'b']);
    expect(preview.answer).toBe('a|b');
    expect(preview).not.toHaveProperty('matchTargets');
  });

  it('keeps only the pairing fields for match', () => {
    const preview = staleQuestion('match');

    expect(preview.options).toEqual(['x', 'y']);
    expect(preview.answer).toBe('1|2');
  });
});

describe('roundFromPreview', () => {
  it('assigns a generated id to every question via the id factory', () => {
    const round: ImportRoundPreview = {
      title: 'History',
      breakAfter: true,
      questions: [
        { type: 'free_text', prompt: 'Q1', answer: 'A1', points: 1 },
        { type: 'free_text', prompt: 'Q2', answer: 'A2', points: 1 },
      ],
    };

    const editorRound = roundFromPreview(
      'r1',
      round,
      (index) => `r1-q${index}`,
    );

    expect(editorRound.questions.map((question) => question.id)).toEqual([
      'r1-q0',
      'r1-q1',
    ]);
    expect(editorRound.title).toBe('History');
    expect(editorRound.breakAfter).toBe(true);
    expect(editorRound.kahootMode).toBe(false);
  });

  it('carries a true kahootMode through from the preview', () => {
    const round: ImportRoundPreview = {
      title: 'Speed Round',
      breakAfter: true,
      kahootMode: true,
      questions: [
        {
          type: 'multiple_choice',
          prompt: 'Q1',
          answer: 'A',
          points: 1,
          options: ['A', 'B'],
        },
      ],
    };

    const editorRound = roundFromPreview(
      'r1',
      round,
      (index) => `r1-q${index}`,
    );

    expect(editorRound.kahootMode).toBe(true);
  });
});

describe('toSaveRequest', () => {
  it('trims the quiz/round titles and converts every question', () => {
    const round = makeRound('r1', ' History ');
    round.questions = [
      {
        ...makeQuestion('q1'),
        type: 'free_text',
        prompt: 'Largest planet?',
        correctText: 'Jupiter',
      },
    ];

    const request = toSaveRequest(' Trivia Night ', [round]);

    expect(request).toEqual({
      title: 'Trivia Night',
      rounds: [
        {
          title: 'History',
          breakAfter: true,
          kahootMode: false,
          questions: [
            {
              type: 'free_text',
              prompt: 'Largest planet?',
              answer: 'Jupiter',
              points: 1,
            },
          ],
        },
      ],
    });
  });

  it('forces breakAfter true on the last round even when unset, leaving earlier rounds as authored', () => {
    const first = makeRound('r1', 'Round 1');
    first.breakAfter = false;
    first.questions = [
      { ...makeQuestion('q1'), type: 'free_text', correctText: 'A' },
    ];
    const last = makeRound('r2', 'Round 2');
    last.breakAfter = false;
    last.questions = [
      { ...makeQuestion('q2'), type: 'free_text', correctText: 'B' },
    ];

    const request = toSaveRequest('Trivia Night', [first, last]);

    expect(request.rounds[0].breakAfter).toBe(false);
    expect(request.rounds[1].breakAfter).toBe(true);
  });

  it('carries a true kahootMode through to the save request', () => {
    const round = makeRound('r1', 'Speed Round');
    round.kahootMode = true;
    round.questions = [
      {
        ...makeQuestion('q1'),
        type: 'multiple_choice',
        prompt: 'Q1',
        options: [
          { text: 'A', isCorrect: true },
          { text: 'B', isCorrect: false },
        ],
      },
    ];

    const request = toSaveRequest('Trivia Night', [round]);

    expect(request.rounds[0].kahootMode).toBe(true);
  });
});

describe('mergeRoundsFromPreview', () => {
  it('appends a preview round with a new title as a brand-new round', () => {
    const current = [makeRound('r1', 'History')];
    current[0].questions = [
      { ...makeQuestion('q1'), type: 'free_text', correctText: 'A' },
    ];
    const preview: ImportRoundPreview[] = [
      {
        title: 'Geography',
        breakAfter: true,
        questions: [
          { type: 'free_text', prompt: 'Q2', answer: 'B', points: 1 },
        ],
      },
    ];
    let idCount = 0;
    const makeId = () => `id${idCount++}`;

    const merged = mergeRoundsFromPreview(current, preview, makeId);

    expect(merged).toHaveLength(2);
    expect(merged[0]).toBe(current[0]);
    expect(merged[1].title).toBe('Geography');
    expect(merged[1].questions).toHaveLength(1);
    expect(merged[1].questions[0].prompt).toBe('Q2');
  });

  it('appends questions onto an existing round matched by title, ignoring case and whitespace', () => {
    const current = [makeRound('r1', ' History ')];
    current[0].breakAfter = true;
    current[0].questions = [
      { ...makeQuestion('q1'), type: 'free_text', correctText: 'A' },
    ];
    const preview: ImportRoundPreview[] = [
      {
        title: 'history',
        breakAfter: false,
        questions: [
          { type: 'free_text', prompt: 'Q2', answer: 'B', points: 2 },
        ],
      },
    ];

    const merged = mergeRoundsFromPreview(current, preview, () =>
      crypto.randomUUID(),
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].title).toBe(' History ');
    // Matching round keeps its own settings — the preview's breakAfter is ignored.
    expect(merged[0].breakAfter).toBe(true);
    expect(merged[0].questions).toHaveLength(2);
    expect(merged[0].questions[1].prompt).toBe('Q2');
  });

  it('leaves the current rounds untouched given an empty preview', () => {
    const current = [makeRound('r1', 'History')];

    const merged = mergeRoundsFromPreview(current, [], () =>
      crypto.randomUUID(),
    );

    expect(merged).toEqual(current);
    expect(merged).not.toBe(current);
  });
});

describe('withSyncedQuestionIds', () => {
  it('backfills dbId onto a question that had none, leaving every other field untouched', () => {
    const edited = {
      ...makeQuestion('q1'),
      type: 'free_text' as const,
      prompt: 'edited since saving',
      correctText: 'A',
    };
    const rounds = [{ ...makeRound('r1', 'History'), questions: [edited] }];
    const freshRounds: ImportRoundPreview[] = [
      {
        title: 'History',
        breakAfter: true,
        questions: [
          {
            questionId: 42,
            type: 'free_text',
            prompt: 'edited since saving',
            answer: 'A',
            points: 1000,
          },
        ],
      },
    ];

    const synced = withSyncedQuestionIds(rounds, freshRounds);

    expect(synced[0].questions[0].dbId).toBe(42);
    expect(synced[0].questions[0].prompt).toBe('edited since saving');
    expect(synced[0].questions[0].id).toBe('q1');
  });

  it('leaves an already-known dbId alone even if the fresh round disagrees', () => {
    const question = {
      ...makeQuestion('q1'),
      dbId: 7,
      type: 'free_text' as const,
      correctText: 'A',
    };
    const rounds = [{ ...makeRound('r1', 'History'), questions: [question] }];
    const freshRounds: ImportRoundPreview[] = [
      {
        title: 'History',
        breakAfter: true,
        questions: [
          {
            questionId: 999,
            type: 'free_text',
            prompt: '',
            answer: 'A',
            points: 1000,
          },
        ],
      },
    ];

    const synced = withSyncedQuestionIds(rounds, freshRounds);

    expect(synced[0].questions[0].dbId).toBe(7);
  });

  it('is a no-op when there is no matching fresh round (e.g. a round added locally after the last save)', () => {
    const question = { ...makeQuestion('q1'), type: 'free_text' as const };
    const rounds = [{ ...makeRound('r1', 'New round'), questions: [question] }];

    const synced = withSyncedQuestionIds(rounds, []);

    expect(synced).toEqual(rounds);
  });
});

describe('moveQuestionToRound', () => {
  const q1 = makeQuestion('q1');
  const q2 = makeQuestion('q2');
  const q3 = makeQuestion('q3');
  const rounds = [
    { ...makeRound('r1', 'One'), questions: [q1, q2] },
    { ...makeRound('r2', 'Two'), questions: [q3] },
  ];

  it('takes the question out of its round and appends it to the target round', () => {
    const moved = moveQuestionToRound(rounds, 'q1', 'r2');

    expect(moved[0].questions).toEqual([q2]);
    expect(moved[1].questions).toEqual([q3, q1]);
  });

  it('leaves the original rounds untouched', () => {
    moveQuestionToRound(rounds, 'q1', 'r2');

    expect(rounds[0].questions).toEqual([q1, q2]);
    expect(rounds[1].questions).toEqual([q3]);
  });

  it('is a no-op for an unknown question or target round, or the same round', () => {
    expect(moveQuestionToRound(rounds, 'nope', 'r2')).toBe(rounds);
    expect(moveQuestionToRound(rounds, 'q1', 'nope')).toBe(rounds);
    expect(moveQuestionToRound(rounds, 'q1', 'r1')).toBe(rounds);
  });
});

describe('getPinnedQuestionCount', () => {
  const round = {
    ...makeRound('r', 'Round'),
    questions: [
      { ...makeQuestion('q1'), dbId: 11 },
      { ...makeQuestion('q2'), dbId: 12 },
      { ...makeQuestion('q3'), dbId: 13 },
      makeQuestion('q4'),
    ],
  };
  const frontier = (
    overrides: Partial<LiveEditFrontier> = {},
  ): LiveEditFrontier => ({
    openedQuestionIds: [11, 12],
    currentRoundIndex: 1,
    hasCurrentBlockStartedLocking: false,
    ...overrides,
  });

  it('pins nothing when no session is live', () => {
    expect(getPinnedQuestionCount(round, 1, undefined)).toBe(0);
  });

  it('pins nothing in a round after the current one', () => {
    expect(getPinnedQuestionCount(round, 2, frontier())).toBe(0);
  });

  it('pins every question in a round before the current one', () => {
    expect(getPinnedQuestionCount(round, 0, frontier())).toBe(4);
  });

  it('pins the opened questions at the start of the current round', () => {
    expect(getPinnedQuestionCount(round, 1, frontier())).toBe(2);
  });

  it('pins nothing in a current round where nothing has opened', () => {
    expect(
      getPinnedQuestionCount(round, 1, frontier({ openedQuestionIds: [] })),
    ).toBe(0);
  });

  it('pins every question in the current round once its block has started locking', () => {
    expect(
      getPinnedQuestionCount(
        round,
        1,
        frontier({ hasCurrentBlockStartedLocking: true }),
      ),
    ).toBe(4);
  });
});
