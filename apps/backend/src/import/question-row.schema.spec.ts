import type { SheetRow } from '@campus-pubquiz/types';
import {
  assembleImportPreview,
  parseQuestionRow,
} from '@/import/question-row.schema';

function makeRow(overrides: Partial<SheetRow> = {}): SheetRow {
  return {
    rowNumber: 2,
    round: 'Round 1',
    type: 'free_text',
    question: 'Largest planet?',
    options: '',
    answer: 'Jupiter',
    points: '2',
    mediaUrl: '',
    answerMediaUrl: '',
    notes: '',
    breakAfter: '',
    ...overrides,
  };
}

describe('parseQuestionRow', () => {
  it('accepts a valid multiple choice row and splits pipe-separated options', () => {
    // Arrange
    const row = makeRow({
      type: 'multiple_choice',
      question: 'Capital of France?',
      options: 'Paris|London|Berlin|Rome',
      answer: 'Paris',
    });

    // Act
    const result = parseQuestionRow(row);

    // Assert
    expect(result).toEqual({
      ok: true,
      roundTitle: 'Round 1',
      roundBreakAfter: false,
      question: {
        type: 'multiple_choice',
        prompt: 'Capital of France?',
        answer: 'Paris',
        points: 2,
        options: ['Paris', 'London', 'Berlin', 'Rome'],
      },
    });
  });

  it('normalizes type spelling variants like "Multiple Choice"', () => {
    const row = makeRow({
      type: ' Multiple Choice ',
      options: 'Paris|London',
      answer: 'Paris',
    });

    const result = parseQuestionRow(row);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.question.type).toBe('multiple_choice');
    }
  });

  it('defaults empty points to 1', () => {
    const result = parseQuestionRow(makeRow({ points: '' }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.question.points).toBe(1);
    }
  });

  it('rejects an unknown question type', () => {
    const result = parseQuestionRow(makeRow({ type: 'karaoke' }));

    expect(result).toEqual({
      ok: false,
      issues: [
        {
          rowNumber: 2,
          field: 'type',
          message: expect.stringContaining('karaoke') as string,
        },
      ],
    });
  });

  it('rejects a missing answer', () => {
    const result = parseQuestionRow(makeRow({ answer: '  ' }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ rowNumber: 2, field: 'answer' }),
      );
    }
  });

  it('rejects a multiple choice answer that is not one of the options', () => {
    const result = parseQuestionRow(
      makeRow({
        type: 'multiple_choice',
        options: 'Paris|London',
        answer: 'Berlin',
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ field: 'answer' }),
      );
    }
  });

  it('rejects multiple choice with fewer than two options', () => {
    const result = parseQuestionRow(
      makeRow({ type: 'multiple_choice', options: 'Paris', answer: 'Paris' }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ field: 'options' }),
      );
    }
  });

  it('rejects picture and audio rows without a valid http(s) media url', () => {
    for (const type of ['picture', 'audio']) {
      const missing = parseQuestionRow(makeRow({ type, mediaUrl: '' }));
      const invalid = parseQuestionRow(
        makeRow({ type, mediaUrl: 'ftp://example.com/x.mp3' }),
      );

      expect(missing.ok).toBe(false);
      expect(invalid.ok).toBe(false);
      if (!missing.ok) {
        expect(missing.issues).toContainEqual(
          expect.objectContaining({ field: 'media_url' }),
        );
      }
    }
  });

  it('accepts an audio row with a valid media url', () => {
    const result = parseQuestionRow(
      makeRow({
        type: 'audio',
        question: 'Name this song.',
        mediaUrl: 'https://example.com/song.mp3',
        answer: 'Bohemian Rhapsody',
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.question.mediaUrl).toBe('https://example.com/song.mp3');
    }
  });

  it('accepts a youtube row with a youtube.com/youtu.be media url', () => {
    const result = parseQuestionRow(
      makeRow({
        type: 'youtube',
        question: 'Name this music video.',
        mediaUrl: 'https://youtu.be/dQw4w9WgXcQ',
        answer: 'Never Gonna Give You Up',
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.question).toEqual(
        expect.objectContaining({
          type: 'youtube',
          mediaUrl: 'https://youtu.be/dQw4w9WgXcQ',
        }),
      );
    }
  });

  it('rejects a youtube row missing a media url or pointing at a non-YouTube url', () => {
    const missing = parseQuestionRow(
      makeRow({ type: 'youtube', mediaUrl: '' }),
    );
    const nonYoutube = parseQuestionRow(
      makeRow({ type: 'youtube', mediaUrl: 'https://example.com/video.mp4' }),
    );

    expect(missing.ok).toBe(false);
    expect(nonYoutube.ok).toBe(false);
    if (!nonYoutube.ok) {
      expect(nonYoutube.issues).toContainEqual(
        expect.objectContaining({ field: 'media_url' }),
      );
    }
  });

  it('accepts an optional answer_media_url on any question type, independent of media_url', () => {
    const result = parseQuestionRow(
      makeRow({
        type: 'free_text',
        question: 'Name this flag.',
        answer: 'France',
        answerMediaUrl: 'https://example.com/france-flag.jpg',
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.question.answerMediaUrl).toBe(
        'https://example.com/france-flag.jpg',
      );
      expect(result.question.mediaUrl).toBeUndefined();
    }
  });

  it('rejects an invalid answer_media_url', () => {
    const result = parseQuestionRow(
      makeRow({ answerMediaUrl: 'ftp://example.com/x.jpg' }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ field: 'answer_media_url' }),
      );
    }
  });

  it('rejects non-numeric, negative, and fractional points', () => {
    for (const points of ['abc', '-1', '0', '1.5']) {
      const result = parseQuestionRow(makeRow({ points }));

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toContainEqual(
          expect.objectContaining({ field: 'points' }),
        );
      }
    }
  });

  it('resolves break_after "1" to roundBreakAfter true, and "0"/blank to false', () => {
    for (const [breakAfter, expected] of [
      ['1', true],
      ['0', false],
      ['', false],
    ] as const) {
      const result = parseQuestionRow(makeRow({ breakAfter }));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.roundBreakAfter).toBe(expected);
      }
    }
  });

  it('rejects an invalid break_after value', () => {
    const result = parseQuestionRow(makeRow({ breakAfter: 'yes' }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ field: 'break_after' }),
      );
    }
  });

  it('rejects a row with an empty round name', () => {
    const result = parseQuestionRow(makeRow({ round: '' }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ field: 'round' }),
      );
    }
  });

  it('accepts a valid sort row and canonicalizes the answer order', () => {
    const result = parseQuestionRow(
      makeRow({
        type: 'sort',
        question: 'Order these planets from the sun outward.',
        options: 'Venus|Mercury|Earth',
        answer: 'Mercury | Venus |Earth',
      }),
    );

    expect(result).toEqual({
      ok: true,
      roundTitle: 'Round 1',
      roundBreakAfter: false,
      question: {
        type: 'sort',
        prompt: 'Order these planets from the sun outward.',
        answer: 'Mercury|Venus|Earth',
        points: 2,
        options: ['Venus', 'Mercury', 'Earth'],
      },
    });
  });

  it('rejects a sort answer that is not a permutation of the options', () => {
    const result = parseQuestionRow(
      makeRow({
        type: 'sort',
        options: 'Venus|Mercury|Earth',
        answer: 'Venus|Mercury',
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ field: 'answer' }),
      );
    }
  });

  it('rejects sort with fewer than two options', () => {
    const result = parseQuestionRow(
      makeRow({ type: 'sort', options: 'Venus', answer: 'Venus' }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ field: 'options' }),
      );
    }
  });

  it('accepts a valid match row and canonicalizes the answer into left-list order', () => {
    const result = parseQuestionRow(
      makeRow({
        type: 'match',
        question: 'Match the hero to their weapon.',
        options: 'arthur|robin hood|captain america+excalibur|shield|bow',
        answer: 'arthur+excalibur|robin hood+bow|captain america+shield',
      }),
    );

    expect(result).toEqual({
      ok: true,
      roundTitle: 'Round 1',
      roundBreakAfter: false,
      question: {
        type: 'match',
        prompt: 'Match the hero to their weapon.',
        answer: 'excalibur|bow|shield',
        points: 2,
        options: ['arthur', 'robin hood', 'captain america'],
        matchTargets: ['excalibur', 'shield', 'bow'],
      },
    });
  });

  it('rejects a match row whose left/right lists have different lengths', () => {
    const result = parseQuestionRow(
      makeRow({
        type: 'match',
        options: 'arthur|robin hood+excalibur',
        answer: 'arthur+excalibur',
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ field: 'options' }),
      );
    }
  });

  it('rejects a match answer that pairs a left item with a right item not in the list', () => {
    const result = parseQuestionRow(
      makeRow({
        type: 'match',
        options: 'arthur|robin hood+excalibur|bow',
        answer: 'arthur+shield|robin hood+bow',
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ field: 'answer' }),
      );
    }
  });

  it('rejects a match answer that reuses the same right item twice', () => {
    const result = parseQuestionRow(
      makeRow({
        type: 'match',
        options: 'arthur|robin hood+excalibur|bow',
        answer: 'arthur+excalibur|robin hood+excalibur',
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ field: 'answer' }),
      );
    }
  });

  it('rejects a match row missing the "+" left/right divider in options', () => {
    const result = parseQuestionRow(
      makeRow({
        type: 'match',
        options: 'arthur|robin hood',
        answer: 'arthur+excalibur',
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ field: 'match_right' }),
      );
    }
  });

  it('accepts a valid closest_guess row with a numeric answer', () => {
    const result = parseQuestionRow(
      makeRow({
        type: 'closest_guess',
        question: 'How many students attend this university?',
        answer: '1000',
        points: '5',
      }),
    );

    expect(result).toEqual({
      ok: true,
      roundTitle: 'Round 1',
      roundBreakAfter: false,
      question: {
        type: 'closest_guess',
        prompt: 'How many students attend this university?',
        answer: '1000',
        points: 5,
      },
    });
  });

  it('rejects a closest_guess row with a non-numeric answer', () => {
    const result = parseQuestionRow(
      makeRow({ type: 'closest_guess', answer: 'a lot' }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ field: 'answer' }),
      );
    }
  });

  it('rejects a closest_guess row with a blank answer', () => {
    const result = parseQuestionRow(
      makeRow({ type: 'closest_guess', answer: '' }),
    );

    expect(result.ok).toBe(false);
  });

  it('collects multiple issues from one broken row', () => {
    const result = parseQuestionRow(
      makeRow({ question: '', answer: '', points: 'many' }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.field).sort()).toEqual([
        'answer',
        'points',
        'question',
      ]);
    }
  });
});

describe('assembleImportPreview', () => {
  it('groups questions into rounds by first appearance and resolves break_after per round', () => {
    // Arrange
    const rows: SheetRow[] = [
      makeRow({ rowNumber: 2, round: 'History', breakAfter: '0' }),
      makeRow({
        rowNumber: 3,
        round: 'Music',
        question: 'Name this song.',
        breakAfter: '0',
      }),
      makeRow({
        rowNumber: 4,
        round: 'History',
        question: 'Name this flag.',
        breakAfter: '0',
      }),
    ];

    // Act
    const preview = assembleImportPreview('Trivia Night', rows);

    // Assert
    expect(preview.isImportable).toBe(true);
    expect(preview.quizTitle).toBe('Trivia Night');
    expect(preview.rounds.map((round) => round.title)).toEqual([
      'History',
      'Music',
    ]);
    expect(preview.rounds[0].questions).toHaveLength(2);
    expect(preview.rounds[0].breakAfter).toBe(false);
    expect(preview.rounds[1].breakAfter).toBe(true);
  });

  it('marks a non-final round as breaking if any of its rows has break_after "1"', () => {
    const rows: SheetRow[] = [
      makeRow({ rowNumber: 2, round: 'History', breakAfter: '' }),
      makeRow({
        rowNumber: 3,
        round: 'History',
        question: 'Name this flag.',
        breakAfter: '1',
      }),
      makeRow({
        rowNumber: 4,
        round: 'Music',
        question: 'Name this song.',
        breakAfter: '',
      }),
    ];

    const preview = assembleImportPreview('Trivia Night', rows);

    expect(preview.rounds[0].breakAfter).toBe(true);
  });

  it('always forces the last round to break, even when every one of its rows is blank/0', () => {
    const rows: SheetRow[] = [
      makeRow({ rowNumber: 2, round: 'History', breakAfter: '1' }),
      makeRow({
        rowNumber: 3,
        round: 'Music',
        question: 'Name this song.',
        breakAfter: '0',
      }),
    ];

    const preview = assembleImportPreview('Trivia Night', rows);

    expect(preview.isImportable).toBe(true);
    expect(preview.rounds[1].title).toBe('Music');
    expect(preview.rounds[1].breakAfter).toBe(true);
  });

  it('reports issues from every broken row and blocks the import', () => {
    const rows: SheetRow[] = [
      makeRow({ rowNumber: 2, breakAfter: '1' }),
      makeRow({ rowNumber: 3, answer: '' }),
      makeRow({ rowNumber: 4, type: 'karaoke' }),
    ];

    const preview = assembleImportPreview('Trivia Night', rows);

    expect(preview.isImportable).toBe(false);
    expect(preview.issues.map((issue) => issue.rowNumber)).toEqual([3, 4]);
    expect(preview.rounds[0].questions).toHaveLength(1);
  });
});
