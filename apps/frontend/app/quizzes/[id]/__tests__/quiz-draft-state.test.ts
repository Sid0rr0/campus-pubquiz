import { describe, expect, it } from 'vitest';
import {
  QUESTION_KINDS,
  type ImportPreview,
  type ImportQuestionPreview,
  type ImportRoundPreview,
  type LiveEditFrontier,
  type QuestionType,
  type RoundEditingDescription,
} from '@campus-pubquiz/types';
import {
  addRound,
  changeQuestionType,
  deleteRound,
  csvImportTitle,
  describeEditorRounds,
  importOutcome,
  makeMatchPair,
  makeOption,
  makeQuestion,
  makeRound,
  mergeRoundsFromPreview,
  moveQuestionToRound,
  moveRound,
  moveTargetRounds,
  questionFromPreview,
  questionToPreview,
  roundFromPreview,
  structureNoteFor,
  titleAfterImport,
  toSaveRequest,
  updateRound,
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
      marginValue: '10',
      marginUnit: 'percent',
      correctText: '',
      mediaUrl: '',
      answerMediaUrl: '',
      clipStart: '',
      clipEnd: '',
      isVideoHidden: false,
      revealStart: '',
      revealEnd: '',
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

describe('YouTube clip fields in the editor draft', () => {
  const preview: ImportQuestionPreview = {
    type: 'youtube',
    prompt: 'Which movie?',
    answer: 'Jaws',
    points: 2,
    mediaUrl: 'https://youtu.be/dQw4w9WgXcQ',
    mediaStartSeconds: 55,
    mediaEndSeconds: 88,
  };

  it('shows the clip seconds as timecodes and saves them back as seconds', () => {
    const question = questionFromPreview('q1', preview);

    expect([question.clipStart, question.clipEnd]).toEqual(['55', '1:28']);
    expect(questionToPreview(question)).toEqual(preview);
  });

  it('saves a typed timecode and drops an unreadable or emptied one', () => {
    const question = questionFromPreview('q1', preview);

    const saved = questionToPreview({
      ...question,
      clipStart: '1:02:03',
      clipEnd: '',
    });

    expect(saved.mediaStartSeconds).toBe(3723);
    expect(saved).not.toHaveProperty('mediaEndSeconds');
  });

  it('round-trips a hidden video and saves a visible one without the field', () => {
    const hidden = questionFromPreview('q1', {
      ...preview,
      isVideoHidden: true,
    });

    expect(hidden.isVideoHidden).toBe(true);
    expect(questionToPreview(hidden)).toEqual({
      ...preview,
      isVideoHidden: true,
    });
    expect(
      questionToPreview(questionFromPreview('q1', preview)),
    ).not.toHaveProperty('isVideoHidden');
  });

  it('shows the reveal clip as timecodes and saves it back as seconds', () => {
    const withReveal: ImportQuestionPreview = {
      ...preview,
      revealStartSeconds: 150,
      revealEndSeconds: 165,
    };

    const question = questionFromPreview('q1', withReveal);

    expect([question.revealStart, question.revealEnd]).toEqual([
      '2:30',
      '2:45',
    ]);
    expect(questionToPreview(question)).toEqual(withReveal);
  });

  it('saves the reveal clip for a YouTube answer media over a non-YouTube question media', () => {
    const imageWithAnswerVideo: ImportQuestionPreview = {
      type: 'free_text',
      prompt: 'Q?',
      answer: 'A',
      points: 1,
      mediaUrl: 'https://example.com/a.jpg',
      answerMediaUrl: 'https://youtu.be/dQw4w9WgXcQ',
      revealStartSeconds: 5,
    };

    const question = questionFromPreview('q1', imageWithAnswerVideo);

    expect(questionToPreview(question)).toEqual(imageWithAnswerVideo);
  });

  it('drops the reveal clip when neither media is a YouTube link', () => {
    const question = {
      ...questionFromPreview('q1', preview),
      mediaUrl: 'https://example.com/a.jpg',
      revealStart: '0:05',
    };

    expect(questionToPreview(question)).not.toHaveProperty(
      'revealStartSeconds',
    );
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

  it('starts a new Number question at a 10% margin', () => {
    const question = { ...makeQuestion('q1'), type: 'number' as const };

    expect(questionToPreview(question).margin).toEqual({
      value: 10,
      unit: 'percent',
    });
  });

  it('round-trips a stored margin, decimals included, through the editor', () => {
    const preview: ImportQuestionPreview = {
      type: 'number',
      prompt: 'Height in metres?',
      answer: '330',
      points: 2,
      margin: { value: 0.5, unit: 'absolute' },
    };

    const question = questionFromPreview('q1', preview);

    expect(question.marginValue).toBe('0.5');
    expect(question.marginUnit).toBe('absolute');
    expect(questionToPreview(question).margin).toEqual({
      value: 0.5,
      unit: 'absolute',
    });
  });

  it('loads a Number question without a stored margin as 10%', () => {
    const question = questionFromPreview('q1', {
      type: 'number',
      prompt: 'Bones?',
      answer: '206',
      points: 1,
    });

    expect(questionToPreview(question).margin).toEqual({
      value: 10,
      unit: 'percent',
    });
  });

  it('saves a margin of 0 as 0, not as the default', () => {
    const question = {
      ...makeQuestion('q1'),
      type: 'number' as const,
      marginValue: '0',
    };

    expect(questionToPreview(question).margin?.value).toBe(0);
  });

  it('saves an emptied margin as not-a-number so the save is refused instead of defaulting', () => {
    const question = {
      ...makeQuestion('q1'),
      type: 'number' as const,
      marginValue: '',
    };

    expect(questionToPreview(question).margin?.value).toBeNaN();
  });

  it('saves no margin for any other type', () => {
    const question = {
      ...makeQuestion('q1'),
      type: 'closest_guess' as const,
      correctText: '5',
    };

    expect(questionToPreview(question)).not.toHaveProperty('margin');
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

describe('changeQuestionType', () => {
  function freeTextQuestion(answer: string) {
    return {
      ...makeQuestion('q1'),
      type: 'free_text' as const,
      prompt: 'How many bones?',
      correctText: answer,
    };
  }

  it('keeps the prompt and a numeric answer when switching Free text to Number', () => {
    const switched = changeQuestionType(freeTextQuestion('206'), 'number');

    expect(switched.type).toBe('number');
    expect(switched.prompt).toBe('How many bones?');
    expect(switched.correctText).toBe('206');
  });

  it('clears an answer that is not a number when switching to Number', () => {
    const switched = changeQuestionType(
      freeTextQuestion('about 200'),
      'number',
    );

    expect(switched.prompt).toBe('How many bones?');
    expect(switched.correctText).toBe('');
  });

  it('leaves the answer alone when switching to any other type', () => {
    const switched = changeQuestionType(
      freeTextQuestion('about 200'),
      'closest_guess',
    );

    expect(switched.correctText).toBe('about 200');
  });

  it('does not mutate the question it was given', () => {
    const original = freeTextQuestion('about 200');

    changeQuestionType(original, 'number');

    expect(original.type).toBe('free_text');
    expect(original.correctText).toBe('about 200');
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

describe('describeEditorRounds', () => {
  const round = {
    ...makeRound('r', 'Round'),
    questions: [
      { ...makeQuestion('q1'), dbId: 11 },
      { ...makeQuestion('q2'), dbId: 12 },
      { ...makeQuestion('q3'), dbId: 13 },
      makeQuestion('q4'),
    ],
  };
  const rounds = [round, round, round];
  const frontier = (
    overrides: Partial<LiveEditFrontier> = {},
  ): LiveEditFrontier => ({
    openedQuestionIds: [11, 12],
    currentRoundIndex: 1,
    hasCurrentBlockStartedLocking: false,
    ...overrides,
  });
  const pinnedCounts = (liveEdit: LiveEditFrontier | undefined) =>
    describeEditorRounds(rounds, liveEdit)?.map(
      (described) => described.pinnedQuestionCount,
    );

  it('describes nothing when no session is live', () => {
    expect(describeEditorRounds(rounds, undefined)).toBeUndefined();
  });

  it('pins every question before the current round, the opened ones in it, and nothing after', () => {
    expect(pinnedCounts(frontier())).toEqual([4, 2, 0]);
  });

  it('pins nothing in a current round where nothing has opened', () => {
    expect(pinnedCounts(frontier({ openedQuestionIds: [] }))).toEqual([
      4, 0, 0,
    ]);
  });

  it('pins every question in the current round once its block has started locking', () => {
    expect(
      pinnedCounts(frontier({ hasCurrentBlockStartedLocking: true })),
    ).toEqual([4, 4, 0]);
  });
});

describe('round edits', () => {
  const rounds = [makeRound('a', 'One'), makeRound('b', 'Two'), makeRound('c')];
  const ids = (list: { id: string }[]) => list.map((round) => round.id);

  it('adds a round at the end named after its position', () => {
    const result = addRound(rounds, 'd');

    expect(result.map((round) => round.title)).toEqual([
      'One',
      'Two',
      '',
      'Round 4',
    ]);
    expect(result[3].id).toBe('d');
    expect(rounds).toHaveLength(3);
  });

  it('updates only the round with the given id', () => {
    const result = updateRound(rounds, 'b', {
      title: 'Renamed',
      breakAfter: true,
    });

    expect(result[1]).toMatchObject({
      id: 'b',
      title: 'Renamed',
      breakAfter: true,
    });
    expect(result[0]).toBe(rounds[0]);
    expect(rounds[1].title).toBe('Two');
  });

  it('deletes the round with the given id', () => {
    expect(ids(deleteRound(rounds, 'b'))).toEqual(['a', 'c']);
    expect(rounds).toHaveLength(3);
  });

  it('moves a round up and down one place', () => {
    expect(ids(moveRound(rounds, 'b', -1))).toEqual(['b', 'a', 'c']);
    expect(ids(moveRound(rounds, 'b', 1))).toEqual(['a', 'c', 'b']);
    expect(ids(rounds)).toEqual(['a', 'b', 'c']);
  });

  it('returns the same rounds when moving past either end', () => {
    expect(moveRound(rounds, 'a', -1)).toBe(rounds);
    expect(moveRound(rounds, 'c', 1)).toBe(rounds);
  });

  it('returns the same rounds when the id is unknown', () => {
    expect(moveRound(rounds, 'zzz', 1)).toBe(rounds);
  });
});

describe('moveTargetRounds', () => {
  const rounds = [
    makeRound('a', 'One'),
    makeRound('b', '  '),
    makeRound('c', 'Three'),
  ];
  const described = (canTake: boolean): RoundEditingDescription => ({
    isReached: false,
    structureEditing: canTake ? 'free' : 'frozen',
    pinnedQuestionCount: 0,
    canTakeMovedQuestion: canTake,
    lockReason: null,
  });

  it('offers every other round when nothing is live', () => {
    expect(moveTargetRounds(rounds, 0, undefined)).toEqual([
      { id: 'b', label: '2. Untitled round', kahootMode: false },
      { id: 'c', label: '3. Three', kahootMode: false },
    ]);
  });

  it('labels a blank-titled round "Untitled round" with its number', () => {
    const labels = moveTargetRounds(rounds, 0, undefined).map(
      (target) => target.label,
    );

    expect(labels[0]).toBe('2. Untitled round');
  });

  it('leaves out the round itself', () => {
    expect(
      moveTargetRounds(rounds, 2, undefined).map((target) => target.id),
    ).toEqual(['a', 'b']);
  });

  it('leaves out rounds that cannot take a moved question', () => {
    const result = moveTargetRounds(rounds, 0, [
      described(true),
      described(false),
      described(true),
    ]);

    expect(result.map((target) => target.id)).toEqual(['c']);
  });

  it('carries the kahoot flag', () => {
    const kahoot = [
      makeRound('a', 'One'),
      { ...makeRound('b', 'Two'), kahootMode: true },
    ];

    expect(moveTargetRounds(kahoot, 0, undefined)[0].kahootMode).toBe(true);
  });
});

describe('structureNoteFor', () => {
  const base: RoundEditingDescription = {
    isReached: false,
    structureEditing: 'free',
    pinnedQuestionCount: 0,
    canTakeMovedQuestion: true,
    lockReason: null,
  };

  it('has no note for a free round', () => {
    expect(structureNoteFor(base)).toBeUndefined();
  });

  it('has no note when nothing is pinned yet', () => {
    expect(
      structureNoteFor({ ...base, structureEditing: 'after-opened' }),
    ).toBeUndefined();
  });

  it('explains pinned opened questions', () => {
    expect(
      structureNoteFor({
        ...base,
        structureEditing: 'after-opened',
        pinnedQuestionCount: 2,
      }),
    ).toBe(
      'The opened questions stay at the start of this round. The questions after them can still be added, reordered, deleted or moved to a later round.',
    );
  });

  it('explains a block that has started locking', () => {
    expect(
      structureNoteFor({
        ...base,
        structureEditing: 'frozen',
        lockReason: 'block-locking',
      }),
    ).toBe(
      "This round's block has started locking, so its questions can't be added, removed or reordered until the quiz moves on. Add new questions to a later round instead.",
    );
  });

  it('explains a round a session has reached', () => {
    expect(
      structureNoteFor({
        ...base,
        structureEditing: 'frozen',
        lockReason: 'reached',
      }),
    ).toBe(
      "A live session has already reached this round, so its questions can't be added, removed or reordered.",
    );
  });
});

describe('importOutcome', () => {
  const ids = () => {
    let next = 0;
    return () => `id-${next++}`;
  };
  const previewQuestion = (prompt: string): ImportQuestionPreview => ({
    type: 'free_text',
    prompt,
    points: 1,
    answer: 'a',
  });
  const previewRound = (
    title: string,
    prompts: string[],
  ): ImportRoundPreview => ({
    title,
    breakAfter: false,
    questions: prompts.map(previewQuestion),
  });
  const preview = (
    rounds: ImportRoundPreview[],
    overrides: Partial<ImportPreview> = {},
  ): ImportPreview => ({
    quizTitle: 'From file',
    rounds,
    issues: [],
    isImportable: true,
    ...overrides,
  });
  const input = (overrides: Partial<Parameters<typeof importOutcome>[0]>) => ({
    rounds: [] as ReturnType<typeof makeRound>[],
    title: '',
    preview: preview([previewRound('A', ['q1'])]),
    shouldAdd: false,
    makeId: ids(),
    ...overrides,
  });

  it('replaces the current rounds with the preview rounds', () => {
    const outcome = importOutcome(
      input({
        rounds: [makeRound('old', 'Old')],
        preview: preview([
          previewRound('A', ['q1']),
          previewRound('B', ['q2']),
        ]),
      }),
    );

    expect(outcome.rounds.map((round) => round.title)).toEqual(['A', 'B']);
  });

  it('adds a preview round with a new title after the current rounds', () => {
    const outcome = importOutcome(
      input({
        rounds: [makeRound('old', 'Old')],
        shouldAdd: true,
      }),
    );

    expect(outcome.rounds.map((round) => round.title)).toEqual(['Old', 'A']);
  });

  it('merges into a current round with the same title when adding', () => {
    const existing = {
      ...makeRound('old', ' a '),
      questions: [makeQuestion('q0')],
    };
    const outcome = importOutcome(
      input({
        rounds: [existing],
        shouldAdd: true,
        preview: preview([previewRound('A', ['q1', 'q2'])]),
      }),
    );

    expect(outcome.rounds).toHaveLength(1);
    expect(outcome.rounds[0].questions).toHaveLength(3);
  });

  it('keeps the current title when there is one', () => {
    expect(importOutcome(input({ title: 'Mine' })).title).toBe('Mine');
  });

  it('takes the preview title when the current title is blank', () => {
    expect(importOutcome(input({ title: '  ' })).title).toBe('From file');
  });

  it('summarises a replace with singular wording', () => {
    expect(importOutcome(input({})).result).toEqual({
      kind: 'summary',
      message: 'Imported 1 round and 1 question — review and edit below.',
    });
  });

  it('summarises a replace with plural wording', () => {
    const outcome = importOutcome(
      input({
        preview: preview([
          previewRound('A', ['q1', 'q2']),
          previewRound('B', []),
        ]),
      }),
    );

    expect(outcome.result).toEqual({
      kind: 'summary',
      message: 'Imported 2 rounds and 2 questions — review and edit below.',
    });
  });

  it('summarises an add with singular wording', () => {
    expect(importOutcome(input({ shouldAdd: true })).result).toEqual({
      kind: 'summary',
      message:
        'Added 1 question from 1 round to the quiz — review and edit below.',
    });
  });

  it('summarises an add with plural wording', () => {
    const outcome = importOutcome(
      input({
        shouldAdd: true,
        preview: preview([
          previewRound('A', ['q1', 'q2']),
          previewRound('B', []),
        ]),
      }),
    );

    expect(outcome.result).toEqual({
      kind: 'summary',
      message:
        'Added 2 questions from 2 rounds to the quiz — review and edit below.',
    });
  });

  it('lists each issue by row and field instead of a summary', () => {
    const outcome = importOutcome(
      input({
        preview: preview([previewRound('A', ['q1'])], {
          issues: [
            { rowNumber: 2, field: 'answer', message: 'missing' },
            { rowNumber: 5, field: 'points', message: 'bad' },
          ],
        }),
      }),
    );

    expect(outcome.result).toEqual({
      kind: 'issues',
      message:
        'Imported with 2 issue(s) to fix before saving — row 2 (answer): missing; row 5 (points): bad',
    });
  });
});

describe('csvImportTitle', () => {
  it('returns the current title when there is one', () => {
    expect(csvImportTitle('  Mine ', 'quiz.csv')).toBe('Mine');
  });

  it('returns the file name without .csv when the title is blank', () => {
    expect(csvImportTitle('  ', 'Pub Night.CSV')).toBe('Pub Night');
  });
});

describe('titleAfterImport', () => {
  it('keeps a title typed while the import was in flight', () => {
    expect(titleAfterImport('Typed meanwhile', 'From sheet')).toBe(
      'Typed meanwhile',
    );
  });

  it('takes the import title when the current title is blank', () => {
    expect(titleAfterImport('   ', 'From sheet')).toBe('From sheet');
  });
});

describe('grading settings round-trip through the editor, per question type', () => {
  const stored: Pick<ImportQuestionPreview, 'matchScoringMode' | 'margin'> = {
    matchScoringMode: 'all_or_nothing',
    margin: { value: 2.5, unit: 'absolute' },
  };

  function previewOf(type: QuestionType): ImportQuestionPreview {
    const base = { type, prompt: 'Q?', points: 1 };
    if (type === 'match') {
      return {
        ...base,
        answer: 'b|a',
        options: ['x', 'y'],
        matchTargets: ['a', 'b'],
        ...stored,
      };
    }
    return { ...base, answer: '7', ...stored };
  }

  it.each(Object.keys(QUESTION_KINDS) as QuestionType[])(
    'keeps exactly the %s type settings from preview to editor and back',
    (type) => {
      const listed = QUESTION_KINDS[type].gradingSettings;

      const saved = questionToPreview(
        questionFromPreview('q1', previewOf(type)),
      );

      expect('matchScoringMode' in saved).toBe(
        listed.includes('matchScoringMode'),
      );
      expect('margin' in saved).toBe(listed.includes('margin'));
      if (listed.includes('matchScoringMode')) {
        expect(saved.matchScoringMode).toBe('all_or_nothing');
      }
      if (listed.includes('margin')) {
        expect(saved.margin).toEqual({ value: 2.5, unit: 'absolute' });
      }
    },
  );

  it('still saves an unreadable margin as not-a-number', () => {
    const question = {
      ...questionFromPreview('q1', previewOf('number')),
      marginValue: 'abc',
    };

    expect(questionToPreview(question).margin?.value).toBeNaN();
  });
});
