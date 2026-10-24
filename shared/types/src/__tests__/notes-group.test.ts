import { describe, expect, it } from 'vitest';
import {
  parseMarginCell,
  questionNotesOf,
  parseNotesGroup,
  writeNotesGroup,
} from '../notes-group';

describe('parseNotesGroup', () => {
  it('reads mm:ss start and end from a quoted group', () => {
    const result = parseNotesGroup('{start: "1:22", end: "2:20"}');

    expect(result).toEqual({
      freeNotes: '',
      clip: { startSeconds: 82, endSeconds: 140 },
      invalidKeys: [],
    });
  });

  it('reads the sample CSV group {start: "55", end: "88"}', () => {
    const result = parseNotesGroup('{start: "55", end: "88"}');

    expect(result.clip).toEqual({ startSeconds: 55, endSeconds: 88 });
  });

  it('reads h:mm:ss times, unquoted', () => {
    const result = parseNotesGroup('{start: 1:02:03, end: 1:05:00}');

    expect(result.clip).toEqual({ startSeconds: 3723, endSeconds: 3900 });
  });

  it('reads plain seconds over 99 and = separators', () => {
    const result = parseNotesGroup("{start='173', end=200}");

    expect(result.clip).toEqual({ startSeconds: 173, endSeconds: 200 });
  });

  it('reads only start when end is missing', () => {
    const result = parseNotesGroup('{start: "0:30"}');

    expect(result.clip).toEqual({ startSeconds: 30 });
  });

  it('reads revealStart, revealEnd and hideVideo', () => {
    const result = parseNotesGroup(
      '{start: "0:10", revealStart: "1:00", revealEnd: "1:15", hideVideo: true}',
    );

    expect(result.clip).toEqual({
      startSeconds: 10,
      revealStartSeconds: 60,
      revealEndSeconds: 75,
      isVideoHidden: true,
    });
  });

  it('does not mistake revealStart for start', () => {
    const result = parseNotesGroup('{revealStart: "0:40"}');

    expect(result.clip).toEqual({ revealStartSeconds: 40 });
  });

  it('does not set isVideoHidden for hideVideo: false', () => {
    const result = parseNotesGroup('{start: "5", hideVideo: false}');

    expect(result.clip).toEqual({ startSeconds: 5 });
  });

  it('reads the legacy YouTube clip line and strips it with its prefix', () => {
    const result = parseNotesGroup(
      'Play the chorus\nYouTube clip: {start: "1:22", end: "2:20"}',
    );

    expect(result).toEqual({
      freeNotes: 'Play the chorus',
      clip: { startSeconds: 82, endSeconds: 140 },
      invalidKeys: [],
    });
  });

  it('keeps free notes before and after the group', () => {
    const result = parseNotesGroup('Intro\n{start: "5"}\nOutro');

    expect(result).toEqual({
      freeNotes: 'Intro\nOutro',
      clip: { startSeconds: 5 },
      invalidKeys: [],
    });
  });

  it('leaves notes without a clip group untouched', () => {
    const notes = 'Ask the audience if no one gets it in 10 seconds {maybe}';

    expect(parseNotesGroup(notes)).toEqual({
      freeNotes: notes,
      clip: {},
      invalidKeys: [],
    });
  });

  it('reports a timecode that does not parse instead of dropping it', () => {
    expect(parseNotesGroup('{start: "soon"}')).toEqual({
      freeNotes: '',
      clip: {},
      invalidKeys: ['start'],
    });
  });

  it('does not read the digits of a malformed timecode as a shorter one', () => {
    const result = parseNotesGroup('{start: "1:2x", revealEnd: "2:00"}');

    expect(result.clip).toEqual({ revealEndSeconds: 120 });
    expect(result.invalidKeys).toEqual(['start']);
  });

  it('reads undefined notes as empty', () => {
    expect(parseNotesGroup(undefined)).toEqual({
      freeNotes: '',
      clip: {},
      invalidKeys: [],
    });
  });
});

describe('writeNotesGroup', () => {
  it('returns the free notes unchanged when the clip is empty', () => {
    expect(writeNotesGroup('Just notes', {})).toBe('Just notes');
  });

  it('appends the canonical group, leaving empty keys out', () => {
    expect(writeNotesGroup('Hint', { startSeconds: 55, endSeconds: 88 })).toBe(
      'Hint\n{start: "55", end: "1:28"}',
    );
    expect(writeNotesGroup('', { startSeconds: 10 })).toBe('{start: "10"}');
  });

  it('writes reveal keys and hideVideo', () => {
    expect(
      writeNotesGroup('', {
        revealStartSeconds: 60,
        revealEndSeconds: 75,
        isVideoHidden: true,
      }),
    ).toBe('{revealStart: "1:00", revealEnd: "1:15", hideVideo: true}');
  });

  it('is read back identically by parseNotesGroup', () => {
    const clip = {
      startSeconds: 55,
      endSeconds: 88,
      revealStartSeconds: 3723,
      isVideoHidden: true as const,
    };

    expect(parseNotesGroup(writeNotesGroup('Hint', clip))).toEqual({
      freeNotes: 'Hint',
      clip,
      invalidKeys: [],
    });
  });
});

describe('grading settings in the notes group', () => {
  it.each([
    ['{margin: 5%}', { value: 5, unit: 'percent' }],
    ['{margin: "5%"}', { value: 5, unit: 'percent' }],
    ['{margin: 2}', { value: 2, unit: 'absolute' }],
    ['{margin: "0.5"}', { value: 0.5, unit: 'absolute' }],
  ])('reads %s as a margin', (notes, margin) => {
    expect(parseNotesGroup(notes)).toEqual({
      freeNotes: '',
      clip: { margin },
      invalidKeys: [],
    });
  });

  it('reads a scoring mode in any case and keeps the other notes', () => {
    expect(parseNotesGroup('Pairs {scoring: All_Or_Nothing} only')).toEqual({
      freeNotes: 'Pairs\nonly',
      clip: { matchScoringMode: 'all_or_nothing' },
      invalidKeys: [],
    });
  });

  it('does not read margin or scoring inside another key', () => {
    expect(
      parseNotesGroup('{matchScoringMode: partial, bigmargin: 5}'),
    ).toEqual({
      freeNotes: '{matchScoringMode: partial, bigmargin: 5}',
      clip: {},
      invalidKeys: [],
    });
  });

  it.each([
    ['{margin: five}', ['margin']],
    ['{margin: -3}', ['margin']],
    ['{scoring: half}', ['scoring']],
    ['{start: "1:2x", margin: "x%"}', ['start', 'margin']],
  ])('reports the unreadable keys of %s', (notes, invalidKeys) => {
    expect(parseNotesGroup(notes).invalidKeys).toEqual(invalidKeys);
  });

  it('writes the settings after the clip and reads them back', () => {
    const clip = {
      startSeconds: 55,
      isVideoHidden: true as const,
      margin: { value: 5, unit: 'percent' as const },
      matchScoringMode: 'partial' as const,
    };
    const written = writeNotesGroup('Hint', clip);

    expect(written).toBe(
      'Hint\n{start: "55", hideVideo: true, margin: "5%", scoring: "partial"}',
    );
    expect(parseNotesGroup(written)).toEqual({
      freeNotes: 'Hint',
      clip,
      invalidKeys: [],
    });
  });
});

describe('questionNotesOf', () => {
  it('drops the settings group and keeps the notes around it', () => {
    expect(questionNotesOf('Accept Abba.\n{start: "1:00", margin: "5%"}')).toBe(
      'Accept Abba.',
    );
  });

  it('keeps braces that set no recognised setting', () => {
    expect(questionNotesOf('Say {a joke}')).toBe('Say {a joke}');
  });

  it('trims the notes left around the group', () => {
    expect(questionNotesOf('\n Hum it.\n{start: "1:00"}\n')).toBe('Hum it.');
  });

  it('is null when nothing is left, or there were no notes', () => {
    expect(questionNotesOf('{start: "1:00"}')).toBeNull();
    expect(questionNotesOf('  ')).toBeNull();
    expect(questionNotesOf(null)).toBeNull();
    expect(questionNotesOf(undefined)).toBeNull();
  });
});

describe('the legacy "YouTube clip:" prefix', () => {
  it.each(['YouTube clip:{start: 5}', 'YouTube clip:  {start: 5}'])(
    'is removed with the group, whatever the spacing: %j',
    (notes) => {
      expect(parseNotesGroup(notes)).toStrictEqual({
        freeNotes: '',
        clip: { startSeconds: 5 },
        invalidKeys: [],
      });
    },
  );
});

describe('parseMarginCell', () => {
  it.each([
    ['2', { value: 2, unit: 'absolute' }],
    ['2.25', { value: 2.25, unit: 'absolute' }],
    ['5%', { value: 5, unit: 'percent' }],
    [' 5% ', { value: 5, unit: 'percent' }],
  ])('reads %j', (raw, expected) => {
    expect(parseMarginCell(raw)).toStrictEqual(expected);
  });

  it.each(['5%x', '5x', 'x5', '5.', '.5', ''])('refuses %j', (raw) => {
    expect(parseMarginCell(raw)).toBeUndefined();
  });
});

describe('the notes group keys', () => {
  it('are read whatever their case', () => {
    expect(
      parseNotesGroup('{START: "5", Margin: "5%", SCORING: "PARTIAL"}'),
    ).toStrictEqual({
      freeNotes: '',
      clip: {
        startSeconds: 5,
        margin: { value: 5, unit: 'percent' },
        matchScoringMode: 'partial',
      },
      invalidKeys: [],
    });
  });

  it('report a timecode that does not read without keeping a field for it', () => {
    expect(parseNotesGroup('{start: abc}')).toStrictEqual({
      freeNotes: '',
      clip: {},
      invalidKeys: ['start'],
    });
  });

  it('read a group that sets no scoring', () => {
    expect(parseNotesGroup('{margin: 2}').clip).toStrictEqual({
      margin: { value: 2, unit: 'absolute' },
    });
  });
});
