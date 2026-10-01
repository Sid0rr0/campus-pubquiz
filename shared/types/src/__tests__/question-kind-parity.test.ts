import { describe, expect, it } from 'vitest';
import type { ImportQuestionPreview, SheetRow } from '../import';
import { QUESTION_KINDS } from '../question-kind';
import { decodeSheetRow } from '../question-row-schema';
import { QUESTION_TYPES, type QuestionType } from '../question-types';
import {
  AUTO_GRADED_TYPES,
  BATCH_GRADED_TYPES,
  HUMAN_GRADED_TYPES,
  KAHOOT_ALLOWED_TYPES,
  OVERRIDABLE_TYPES,
} from '../scoring';

type Verdict = 'valid' | 'invalid';

interface ParityCase {
  name: string;
  question: ImportQuestionPreview;
  import: Verdict;
  draft: Verdict;
  /** Set only where the two paths disagree today; ticket 02 flips these. */
  divergence?: string;
}

const YOUTUBE = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const AUDIO = 'https://example.com/clip.mp3';

function q(
  overrides: Partial<ImportQuestionPreview> &
    Pick<ImportQuestionPreview, 'type'>,
): ImportQuestionPreview {
  return { prompt: 'Q?', answer: 'A', points: 1, ...overrides };
}

/**
 * How the sheet would carry `question` — the import path's input. A match
 * answer is the draft's right-hand list paired up with the left items in order.
 */
function toSheetRow(question: ImportQuestionPreview): SheetRow {
  const isMatch = question.type === 'match';
  const options = question.options ?? [];
  const targets = question.matchTargets ?? [];
  const pairedAnswer = question.answer
    .split('|')
    .map((right, index) => `${options[index] ?? ''}+${right}`)
    .join('|');
  return {
    rowNumber: 2,
    round: 'Round 1',
    type: question.type,
    question: question.prompt,
    options: isMatch
      ? `${options.join('|')}+${targets.join('|')}`
      : options.join('|'),
    answer: isMatch ? pairedAnswer : question.answer,
    points: String(question.points),
    mediaUrl: question.mediaUrl ?? '',
    answerMediaUrl: question.answerMediaUrl ?? '',
    notes: question.notes ?? '',
    breakAfter: '',
    category: '',
    author: '',
  };
}

const CASES: ParityCase[] = [
  // free_text
  {
    name: 'free_text with an answer',
    question: q({ type: 'free_text', answer: 'Paris' }),
    import: 'valid',
    draft: 'valid',
  },
  {
    name: 'free_text with a blank answer',
    question: q({ type: 'free_text', answer: '' }),
    import: 'invalid',
    draft: 'invalid',
  },
  {
    name: 'free_text with a non-http media url',
    question: q({ type: 'free_text', mediaUrl: 'ftp://example.com/x.png' }),
    import: 'invalid',
    draft: 'invalid',
  },
  {
    name: 'free_text with zero points',
    question: q({ type: 'free_text', points: 0 }),
    import: 'invalid',
    draft: 'invalid',
  },

  // multiple_choice
  {
    name: 'multiple_choice whose answer is an option',
    question: q({
      type: 'multiple_choice',
      options: ['Paris', 'London'],
      answer: 'Paris',
    }),
    import: 'valid',
    draft: 'valid',
  },
  {
    name: 'multiple_choice with a single option',
    question: q({
      type: 'multiple_choice',
      options: ['Paris'],
      answer: 'Paris',
    }),
    import: 'invalid',
    draft: 'invalid',
  },
  {
    name: 'multiple_choice whose answer is not an option',
    question: q({
      type: 'multiple_choice',
      options: ['Paris', 'London'],
      answer: 'Rome',
    }),
    import: 'invalid',
    draft: 'invalid',
  },
  {
    name: 'multiple_choice with duplicate options',
    question: q({
      type: 'multiple_choice',
      options: ['Paris', 'Paris', 'London'],
      answer: 'Paris',
    }),
    import: 'valid',
    draft: 'invalid',
    divergence: 'duplicate multiple-choice options',
  },

  // audio
  {
    name: 'audio with a media url',
    question: q({ type: 'audio', mediaUrl: AUDIO }),
    import: 'valid',
    draft: 'valid',
  },
  {
    name: 'audio without a media url',
    question: q({ type: 'audio' }),
    import: 'invalid',
    draft: 'invalid',
  },

  // youtube
  {
    name: 'youtube with a youtube link',
    question: q({ type: 'youtube', mediaUrl: YOUTUBE }),
    import: 'valid',
    draft: 'valid',
  },
  {
    name: 'youtube with a non-youtube link',
    question: q({ type: 'youtube', mediaUrl: AUDIO }),
    import: 'invalid',
    draft: 'invalid',
  },
  {
    name: 'youtube without a media url',
    question: q({ type: 'youtube' }),
    import: 'invalid',
    draft: 'invalid',
  },

  // closest_guess
  {
    name: 'closest_guess with a numeric answer',
    question: q({ type: 'closest_guess', answer: '42.5' }),
    import: 'valid',
    draft: 'valid',
  },
  {
    name: 'closest_guess with a non-numeric answer',
    question: q({ type: 'closest_guess', answer: 'lots' }),
    import: 'invalid',
    draft: 'invalid',
  },

  // sort
  {
    name: 'sort whose answer reorders the options',
    question: q({ type: 'sort', options: ['a', 'b', 'c'], answer: 'c|a|b' }),
    import: 'valid',
    draft: 'valid',
  },
  {
    name: 'sort whose answer drops an option',
    question: q({ type: 'sort', options: ['a', 'b', 'c'], answer: 'a|b' }),
    import: 'invalid',
    draft: 'invalid',
  },
  {
    name: 'sort with a single item',
    question: q({ type: 'sort', options: ['a'], answer: 'a' }),
    import: 'invalid',
    draft: 'invalid',
  },

  // match
  {
    name: 'match with a one-to-one pairing',
    question: q({
      type: 'match',
      options: ['a', 'b'],
      matchTargets: ['x', 'y'],
      answer: 'y|x',
    }),
    import: 'valid',
    draft: 'valid',
  },
  {
    name: 'match with unequal list lengths',
    question: q({
      type: 'match',
      options: ['a', 'b'],
      matchTargets: ['x', 'y', 'z'],
      answer: 'x|y',
    }),
    import: 'invalid',
    draft: 'invalid',
  },
  {
    name: 'match whose answer uses an unknown right item',
    question: q({
      type: 'match',
      options: ['a', 'b'],
      matchTargets: ['x', 'y'],
      answer: 'x|z',
    }),
    import: 'invalid',
    draft: 'invalid',
  },
  {
    name: 'match with a repeated left item',
    question: q({
      type: 'match',
      options: ['a', 'a'],
      matchTargets: ['x', 'y'],
      answer: 'x|y',
    }),
    import: 'invalid',
    draft: 'valid',
    divergence: 'match pairing',
  },
  {
    name: 'match with a repeated right item',
    question: q({
      type: 'match',
      options: ['a', 'b'],
      matchTargets: ['x', 'x'],
      answer: 'x|x',
    }),
    import: 'invalid',
    draft: 'valid',
    divergence: 'match pairing',
  },
];

interface GradingFlags {
  gradingMode: 'auto' | 'batch' | 'human';
  overridable: boolean;
  kahootAllowed: boolean;
}

const EXPECTED_FLAGS: Record<QuestionType, GradingFlags> = {
  free_text: { gradingMode: 'auto', overridable: true, kahootAllowed: false },
  multiple_choice: {
    gradingMode: 'auto',
    overridable: true,
    kahootAllowed: true,
  },
  audio: { gradingMode: 'human', overridable: true, kahootAllowed: false },
  youtube: { gradingMode: 'human', overridable: true, kahootAllowed: false },
  sort: { gradingMode: 'auto', overridable: true, kahootAllowed: true },
  match: { gradingMode: 'auto', overridable: true, kahootAllowed: true },
  closest_guess: {
    gradingMode: 'batch',
    overridable: false,
    kahootAllowed: false,
  },
};

function importVerdict(question: ImportQuestionPreview): Verdict {
  const candidate = decodeSheetRow(toSheetRow(question), question.type);
  return QUESTION_KINDS[question.type].importSchema.safeParse(candidate).success
    ? 'valid'
    : 'invalid';
}

function draftVerdict(question: ImportQuestionPreview): Verdict {
  return QUESTION_KINDS[question.type].draftSchema.safeParse(question).success
    ? 'valid'
    : 'invalid';
}

describe('question kind registry', () => {
  it('has exactly one entry per question type', () => {
    expect(Object.keys(QUESTION_KINDS).sort()).toEqual(
      [...QUESTION_TYPES].sort(),
    );
    for (const type of QUESTION_TYPES) {
      expect(QUESTION_KINDS[type].type).toBe(type);
    }
  });

  it('lists the seven known question types once each', () => {
    expect([...QUESTION_TYPES].sort()).toEqual([
      'audio',
      'closest_guess',
      'free_text',
      'match',
      'multiple_choice',
      'sort',
      'youtube',
    ]);
  });
});

describe('question kind grading flags', () => {
  it.each(QUESTION_TYPES)(
    "%s matches today's grading mode, overridable and kahoot-allowed",
    (type) => {
      const { gradingMode, overridable, kahootAllowed } = QUESTION_KINDS[type];
      expect({ gradingMode, overridable, kahootAllowed }).toEqual(
        EXPECTED_FLAGS[type],
      );
    },
  );

  it('agrees with the Scoring module lists', () => {
    for (const type of QUESTION_TYPES) {
      const kind = QUESTION_KINDS[type];
      expect(AUTO_GRADED_TYPES.includes(type)).toBe(
        kind.gradingMode === 'auto',
      );
      expect(BATCH_GRADED_TYPES.includes(type)).toBe(
        kind.gradingMode === 'batch',
      );
      expect(HUMAN_GRADED_TYPES.includes(type)).toBe(
        kind.gradingMode === 'human',
      );
      expect(OVERRIDABLE_TYPES.includes(type)).toBe(kind.overridable);
      expect(KAHOOT_ALLOWED_TYPES.includes(type)).toBe(kind.kahootAllowed);
    }
  });

  it('keeps free_text out of kahoot rounds although it auto-grades (ADR 0001)', () => {
    expect(QUESTION_KINDS.free_text.gradingMode).toBe('auto');
    expect(QUESTION_KINDS.free_text.kahootAllowed).toBe(false);
  });
});

describe('import and draft validation parity', () => {
  it('covers valid and invalid cases for every type', () => {
    for (const type of QUESTION_TYPES) {
      const verdicts = CASES.filter((c) => c.question.type === type).map(
        (c) => c.draft,
      );
      expect(verdicts, type).toContain('valid');
      expect(verdicts, type).toContain('invalid');
    }
  });

  it.each(CASES)('$name: import and draft verdicts are pinned', (testCase) => {
    expect(importVerdict(testCase.question)).toBe(testCase.import);
    expect(draftVerdict(testCase.question)).toBe(testCase.draft);
  });

  it('names a divergence for exactly the cases where the paths disagree', () => {
    for (const testCase of CASES) {
      expect(testCase.import !== testCase.draft, testCase.name).toBe(
        testCase.divergence !== undefined,
      );
    }
  });

  it('records the two known divergences', () => {
    const named = new Set(CASES.map((c) => c.divergence).filter(Boolean));
    expect(named).toEqual(
      new Set(['duplicate multiple-choice options', 'match pairing']),
    );
  });
});
