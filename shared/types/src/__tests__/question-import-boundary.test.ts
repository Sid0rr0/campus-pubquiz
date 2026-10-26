import { describe, expect, it } from 'vitest';
import type { SheetRow } from '../import';
import {
  answerOnlyCsv,
  choicesCsv,
  matchCsv,
  toCanonicalMatchAnswer,
} from '../question-csv-codec';
import { checkQuestion, parseQuestionPayload } from '../question-kind';
import {
  decodeSheetRow,
  encodeSheetRow,
  sheetFieldForIssue,
  sheetRowMetaSchema,
} from '../question-row-schema';

/**
 * The import boundary: what a bad or sloppy sheet row turns into. Every
 * issue is asserted by the path and message the author sees.
 */

const BASE = { prompt: 'Q?', answer: 'A', points: 1 };

/** The issues checkQuestion reports for a candidate, as path and message. */
function issuesOf(candidate: { type?: unknown }) {
  const checked = checkQuestion(candidate);
  return checked.success
    ? []
    : checked.issues.map(({ path, message }) => ({ path, message }));
}

describe('question schemas: base fields', () => {
  const freeText = { type: 'free_text', ...BASE };

  it('accepts a plain question', () => {
    expect(issuesOf(freeText)).toEqual([]);
  });

  it.each([
    [{ prompt: '' }, ['prompt'], 'Missing question text'],
    [{ answer: '' }, ['answer'], 'Missing answer'],
    [{ points: 'many' }, ['points'], 'Points must be a positive whole number'],
    [{ points: 1.5 }, ['points'], 'Points must be a positive whole number'],
    [{ points: 0 }, ['points'], 'Points must be a positive whole number'],
    [
      { mediaStartSeconds: 'soon' },
      ['mediaStartSeconds'],
      'Clip times must be whole seconds',
    ],
    [
      { mediaEndSeconds: 1.5 },
      ['mediaEndSeconds'],
      'Clip times must be whole seconds',
    ],
    [
      { revealStartSeconds: -1 },
      ['revealStartSeconds'],
      'Clip times must not be negative',
    ],
  ])('reports %j against %j as "%s"', (change, path, message) => {
    expect(issuesOf({ ...freeText, ...change })).toContainEqual({
      path,
      message,
    });
  });

  it.each(['mediaUrl', 'answerMediaUrl'])(
    'accepts http and https links on %s',
    (field) => {
      expect(
        issuesOf({ ...freeText, [field]: 'http://example.com/a.png' }),
      ).toEqual([]);
      expect(
        issuesOf({ ...freeText, [field]: 'https://example.com/a.png' }),
      ).toEqual([]);
    },
  );

  it.each([
    'ftp://example.com/a.png',
    'xhttp://example.com/a.png',
    'httpx://example.com/a.png',
    'not a link',
  ])('refuses the link %s', (link) => {
    expect(issuesOf({ ...freeText, mediaUrl: link })).toEqual([
      { path: ['mediaUrl'], message: 'Media URL must be a valid http(s) URL' },
    ]);
    expect(issuesOf({ ...freeText, answerMediaUrl: link })).toEqual([
      {
        path: ['answerMediaUrl'],
        message: 'Media URL must be a valid http(s) URL',
      },
    ]);
  });
});

describe('question schemas: multiple choice', () => {
  const choice = {
    type: 'multiple_choice',
    ...BASE,
    options: ['A', 'B'],
  };

  it('accepts a question whose answer is one of its options', () => {
    expect(issuesOf(choice)).toEqual([]);
  });

  it('needs two options', () => {
    expect(issuesOf({ ...choice, options: ['A'] })).toContainEqual({
      path: ['options'],
      message: 'Provide at least two options',
    });
  });

  it('needs the answer to be one of the options', () => {
    expect(issuesOf({ ...choice, answer: 'C' })).toEqual([
      { path: ['answer'], message: 'Answer must be one of the options' },
    ]);
  });

  it('refuses a repeated option, ignoring surrounding spaces', () => {
    const repeated = { path: ['options'], message: 'Options must not repeat' };

    expect(issuesOf({ ...choice, options: ['A', 'A'] })).toEqual([repeated]);
    expect(issuesOf({ ...choice, options: ['A', ' A'] })).toEqual([repeated]);
  });
});

describe('question schemas: number and closest guess', () => {
  it.each(['number', 'closest_guess'])('%s needs a numeric answer', (type) => {
    expect(issuesOf({ type, ...BASE, answer: 'lots' })).toEqual([
      { path: ['answer'], message: 'Answer must be a number' },
    ]);
  });

  const number = { type: 'number', ...BASE, answer: '10' };

  it('reports a margin that is not a number against its value', () => {
    expect(
      issuesOf({ ...number, margin: { value: 'wide', unit: 'absolute' } }),
    ).toContainEqual({
      path: ['margin', 'value'],
      message: 'Margin must be a number',
    });
  });

  it('refuses a percentage margin over 100 but allows exactly 100', () => {
    expect(
      issuesOf({ ...number, margin: { value: 101, unit: 'percent' } }),
    ).toEqual([
      {
        path: ['margin', 'value'],
        message: 'A percentage margin must be at most 100',
      },
    ]);
    expect(
      issuesOf({ ...number, margin: { value: 100, unit: 'percent' } }),
    ).toEqual([]);
    expect(
      issuesOf({ ...number, margin: { value: 500, unit: 'absolute' } }),
    ).toEqual([]);
  });
});

describe('question schemas: sort', () => {
  const sort = {
    type: 'sort',
    ...BASE,
    options: ['A', 'B', 'C'],
    answer: 'C|A|B',
  };

  it('accepts an answer that lists every option once', () => {
    expect(issuesOf(sort)).toEqual([]);
  });

  it('refuses options already in the correct order, which phones would show as the answer', () => {
    expect(issuesOf({ ...sort, answer: 'A|B|C' })).toEqual([
      {
        path: ['options'],
        message:
          'Options are already in the correct order — list them shuffled so phones do not see the answer',
      },
    ]);
  });

  it('needs two items', () => {
    expect(issuesOf({ ...sort, options: ['A'], answer: 'A' })).toContainEqual({
      path: ['options'],
      message: 'Provide at least two items',
    });
  });

  it('needs the answer to list every option exactly once', () => {
    expect(issuesOf({ ...sort, answer: 'A|B' })).toEqual([
      {
        path: ['answer'],
        message:
          'Answer must list every option exactly once, in the correct order',
      },
    ]);
  });
});

describe('question schemas: match', () => {
  const match = {
    type: 'match',
    ...BASE,
    options: ['A', 'B'],
    matchTargets: ['X', 'Y'],
    answer: 'Y|X',
  };

  it('accepts a full pairing', () => {
    expect(issuesOf(match)).toEqual([]);
  });

  it('needs two left items and two right items', () => {
    expect(
      issuesOf({ ...match, options: ['A'], matchTargets: ['X', 'Y'] }),
    ).toContainEqual({
      path: ['options'],
      message: 'Provide at least two left items',
    });
    expect(
      issuesOf({ ...match, options: ['A', 'B'], matchTargets: ['X'] }),
    ).toContainEqual({
      path: ['matchTargets'],
      message: 'Provide at least two right items',
    });
  });

  it('needs both lists to be the same length', () => {
    expect(
      issuesOf({ ...match, matchTargets: ['X', 'Y', 'Z'], answer: 'X|Y|Z' }),
    ).toContainEqual({
      path: ['matchTargets'],
      message: 'Left and right lists must have the same number of items',
    });
  });

  it('reports a repeated left item alone, not with a knock-on answer issue', () => {
    expect(issuesOf({ ...match, options: ['A', 'A'] })).toEqual([
      { path: ['options'], message: 'Left items must not repeat' },
    ]);
  });

  it.each([
    ['a repeated right item', { matchTargets: ['X', 'X'], answer: 'X|X' }],
    ['an answer that is not the right items', { answer: 'X|Z' }],
  ])('reports %s against the answer', (_name, change) => {
    expect(issuesOf({ ...match, ...change })).toEqual([
      {
        path: ['answer'],
        message: 'Answer must pair every right item to a left item, one each',
      },
    ]);
  });
});

describe('checkQuestion', () => {
  it('reports an unknown type as one issue on type, naming every known type', () => {
    expect(checkQuestion({ type: 'riddle' })).toEqual({
      success: false,
      issues: [
        {
          path: ['type'],
          code: 'invalid_value',
          message:
            'Unknown question type — expected one of: multiple_choice, free_text, sort, match, closest_guess, number',
        },
      ],
    });
  });
});

describe('parseQuestionPayload', () => {
  it('names the type and the root of a payload that is not an object', () => {
    expect(() => parseQuestionPayload('free_text', 'nope')).toThrow(
      /^Stored free_text payload is malformed — \(payload\): /,
    );
  });

  it('lists every offending field by its dotted path, separated by semicolons', () => {
    expect(() =>
      parseQuestionPayload('number', {
        margin: { value: 'wide', unit: 'bogus' },
      }),
    ).toThrow(
      /^Stored number payload is malformed — margin\.value: [^;]+; margin\.unit: [^;]+$/,
    );
  });
});

describe('sheet columns', () => {
  it.each([
    [{ path: ['prompt'], code: 'too_small' }, 'question'],
    [{ path: ['mediaUrl'], code: 'invalid_format' }, 'media_url'],
    [{ path: ['answerMediaUrl'], code: 'invalid_format' }, 'answer_media_url'],
    [{ path: ['matchTargets'], code: 'too_small' }, 'match_right'],
    [{ path: ['matchTargets'], code: 'custom' }, 'options'],
    [{ path: ['margin', 'value'], code: 'custom' }, 'notes'],
    [{ path: ['scoringMode'], code: 'invalid_value' }, 'notes'],
    [{ path: ['answer'], code: 'custom' }, 'answer'],
    [{ path: ['points'], code: 'invalid_type' }, 'points'],
    [{ path: [], code: 'custom' }, 'row'],
  ])('reports the issue %j against the column %s', (issue, column) => {
    expect(sheetFieldForIssue({ ...issue, message: 'x' })).toBe(column);
  });
});

describe('sheet row meta', () => {
  const meta = {
    round: 'R1',
    break_after: '',
    category: '',
    show_round_note: '',
  };

  function messagesOf(candidate: unknown) {
    const parsed = sheetRowMetaSchema.safeParse(candidate);
    return parsed.success
      ? []
      : parsed.error.issues.map(({ path, message }) => ({ path, message }));
  }

  it('accepts blank, 0 and 1 for the two flags', () => {
    for (const flag of ['', '0', '1']) {
      expect(
        messagesOf({ ...meta, break_after: flag, show_round_note: flag }),
      ).toEqual([]);
    }
  });

  it('needs a round name', () => {
    expect(messagesOf({ ...meta, round: '' })).toEqual([
      { path: ['round'], message: 'Missing round name' },
    ]);
  });

  it('refuses any other flag value', () => {
    expect(messagesOf({ ...meta, break_after: '2' })).toEqual([
      {
        path: ['break_after'],
        message: 'break_after must be "1", "0", or blank',
      },
    ]);
    expect(messagesOf({ ...meta, show_round_note: 'yes' })).toEqual([
      {
        path: ['show_round_note'],
        message: 'show_round_note must be "1", "0", or blank',
      },
    ]);
  });

  it('allows a round note of 500 characters and refuses 501', () => {
    expect(messagesOf({ ...meta, round_note: 'x'.repeat(500) })).toEqual([]);
    expect(messagesOf({ ...meta, round_note: 'x'.repeat(501) })).toEqual([
      { path: ['round_note'], message: 'Round note is over 500 characters' },
    ]);
  });
});

describe('decodeSheetRow: cells are trimmed, blanks mean unset', () => {
  const ROW: SheetRow = {
    rowNumber: 2,
    round: 'R1',
    type: 'free_text',
    question: 'Q?',
    options: '',
    answer: 'A',
    points: '',
    mediaUrl: '',
    answerMediaUrl: '',
    notes: '',
    breakAfter: '',
    category: '',
    author: '',
    roundNote: '',
    showRoundNote: '',
  };

  it('reads a tidy row as it is, leaving blank optional cells unset', () => {
    const { meta, question } = decodeSheetRow(ROW, 'free_text');

    expect(meta).toStrictEqual({
      round: 'R1',
      break_after: '',
      category: '',
      author: undefined,
      round_note: undefined,
      show_round_note: '',
    });
    expect(question).toMatchObject({
      type: 'free_text',
      prompt: 'Q?',
      answer: 'A',
      points: 1,
      notes: undefined,
      mediaUrl: undefined,
    });
  });

  it('trims every padded cell', () => {
    const { meta, question } = decodeSheetRow(
      {
        ...ROW,
        round: '  R1 ',
        question: '  Q?  ',
        answer: '  A ',
        points: ' 3 ',
        mediaUrl: ' https://example.com/a.png ',
        notes: '  a note ',
        breakAfter: ' 1 ',
        author: '  Sam ',
        roundNote: ' Read slowly ',
        showRoundNote: ' 1 ',
      },
      'free_text',
    );

    expect(meta).toStrictEqual({
      round: 'R1',
      break_after: '1',
      category: '',
      author: 'Sam',
      round_note: 'Read slowly',
      show_round_note: '1',
    });
    expect(question).toMatchObject({
      prompt: 'Q?',
      answer: 'A',
      points: 3,
      mediaUrl: 'https://example.com/a.png',
      notes: 'a note',
    });
  });

  it('treats cells of only spaces as blank', () => {
    const { meta, question } = decodeSheetRow(
      {
        ...ROW,
        points: '   ',
        author: '   ',
        roundNote: '  ',
        notes: '  ',
        mediaUrl: '  ',
      },
      'free_text',
    );

    expect(question).toMatchObject({
      points: 1,
      notes: undefined,
      mediaUrl: undefined,
    });
    expect(meta).toMatchObject({ author: undefined, round_note: undefined });
  });

  it('resolves a category to its canonical casing, trimmed', () => {
    expect(
      decodeSheetRow({ ...ROW, category: '  science & NATURE ' }, 'free_text')
        .meta,
    ).toMatchObject({ category: 'Science & nature' });
  });

  it('blanks a category it does not know', () => {
    expect(
      decodeSheetRow({ ...ROW, category: 'Astrology' }, 'free_text').meta,
    ).toMatchObject({ category: '' });
  });

  it('reports an unknown match scoring mode naming the modes it accepts', () => {
    const { clipIssues } = decodeSheetRow(
      { ...ROW, notes: '{scoring: "half"}' },
      'match',
    );

    expect(clipIssues).toEqual([
      {
        path: ['notes'],
        code: 'custom',
        message:
          'Scoring "scoring" is not a match scoring mode — use per_item or one_off',
      },
    ]);
  });
});

describe('encodeSheetRow: round-level cells', () => {
  const question = { type: 'free_text' as const, ...BASE };
  const bare = { title: 'R1', breakAfter: false };

  it('writes blank category, author and note on a last row of a round that has none', () => {
    const row = encodeSheetRow(bare, question, true);

    expect(row).toMatchObject({
      category: '',
      author: '',
      roundNote: '',
      breakAfter: '',
      showRoundNote: '',
    });
  });

  it('writes the round-level cells on the last row only', () => {
    const round = {
      title: 'R1',
      breakAfter: true,
      category: 'Music' as const,
      author: 'Sam',
      note: 'Read slowly',
      showNoteOnScreen: true,
    };

    expect(encodeSheetRow(round, question, true)).toMatchObject({
      category: 'Music',
      author: 'Sam',
      roundNote: 'Read slowly',
      breakAfter: '1',
      showRoundNote: '1',
    });
    expect(encodeSheetRow(round, question, false)).toMatchObject({
      category: '',
      author: '',
      roundNote: '',
      breakAfter: '',
      showRoundNote: '',
    });
  });
});

describe('option and answer cells', () => {
  it('splits options on pipes, trimming each and dropping blanks', () => {
    expect(
      choicesCsv.decode({
        options: ' Paris |  | London ||Berlin|',
        answer: ' Paris ',
      }),
    ).toEqual({ answer: 'Paris', options: ['Paris', 'London', 'Berlin'] });
  });

  it('trims a free answer', () => {
    expect(answerOnlyCsv.decode({ options: '', answer: '  42 ' })).toEqual({
      answer: '42',
    });
  });

  it('writes a free answer with an empty options cell', () => {
    expect(answerOnlyCsv.encode({ type: 'free_text', ...BASE })).toEqual({
      options: '',
      answer: 'A',
    });
  });

  it('writes a question without options as an empty options cell', () => {
    expect(choicesCsv.encode({ type: 'multiple_choice', ...BASE })).toEqual({
      options: '',
      answer: 'A',
    });
  });
});

describe('match cells', () => {
  it('reads both lists and reorders the answer into the left list order', () => {
    expect(
      matchCsv.decode({
        options: ' A | B + X | Y ',
        answer: ' B+Y | A+X ',
      }),
    ).toEqual({
      answer: 'X|Y',
      options: ['A', 'B'],
      matchTargets: ['X', 'Y'],
      answerIssue: undefined,
    });
  });

  it('flags an answer that is not written as pairs and keeps it trimmed', () => {
    expect(matchCsv.decode({ options: 'A|B+X|Y', answer: '  X|Y  ' })).toEqual({
      answer: 'X|Y',
      options: ['A', 'B'],
      matchTargets: ['X', 'Y'],
      answerIssue: {
        path: ['answer'],
        code: 'custom',
        message:
          'Answer must pair each left item with a right item, e.g. "left1+right1|left2+right2"',
      },
    });
  });

  it('reads an options cell without a plus as a left list and no right list', () => {
    expect(matchCsv.decode({ options: 'A|B', answer: 'x' })).toMatchObject({
      options: ['A', 'B'],
      matchTargets: [],
    });
  });

  it('writes both lists in one cell and the answer as explicit pairs', () => {
    expect(
      matchCsv.encode({
        type: 'match',
        ...BASE,
        options: ['A', 'B'],
        matchTargets: ['X', 'Y'],
        answer: 'Y|X',
      }),
    ).toEqual({ options: 'A|B+X|Y', answer: 'A+Y|B+X' });
  });

  it('writes a missing right item as an empty one, and missing lists as empty', () => {
    expect(
      matchCsv.encode({
        type: 'match',
        ...BASE,
        options: ['A', 'B'],
        matchTargets: ['X', 'Y'],
        answer: 'X',
      }),
    ).toEqual({ options: 'A|B+X|Y', answer: 'A+X|B+' });
    expect(matchCsv.encode({ type: 'match', ...BASE, answer: '' })).toEqual({
      options: '+',
      answer: '',
    });
  });
});

describe('toCanonicalMatchAnswer', () => {
  const left = ['A', 'B'];
  const right = ['X', 'Y'];

  it('puts the right items in left order, whatever order the pairs came in', () => {
    expect(toCanonicalMatchAnswer('A+X|B+Y', left, right)).toBe('X|Y');
    expect(toCanonicalMatchAnswer('B+Y|A+X', left, right)).toBe('X|Y');
  });

  it('ignores spaces around each side of a pair', () => {
    expect(toCanonicalMatchAnswer('A + X|B + Y', left, right)).toBe('X|Y');
  });

  it.each([
    ['a pair without a plus', 'AB', ['A'], ['AB']],
    ['a pair with no right side', 'A+', ['A'], ['']],
    ['a pair with no left side', '+X', [''], ['X']],
    ['a pair missing for a left item', 'A+X', left, right],
    ['more pairs than left items', 'A+X|A+X', ['A'], ['X']],
    ['one pair without a plus among others', 'A+X|B', left, right],
    ['a right item used twice', 'A+X|B+X', left, right],
    ['a right item that is not in the right list', 'A+X|B+Z', left, right],
    ['a left item that is not in the left list', 'A+X|C+Y', left, right],
  ])('refuses %s', (_name, answer, leftItems, rightItems) => {
    expect(toCanonicalMatchAnswer(answer, leftItems, rightItems)).toBe(
      undefined,
    );
  });
});
