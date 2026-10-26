import { describe, expect, it } from 'vitest';
import { DEFAULT_MARGIN, type Margin } from '../margin';
import { QUESTION_KINDS } from '../question-kind';
import { QUESTION_TYPES, type QuestionType } from '../question-types';
import type { ScoringMode } from '../scoring-mode';
import {
  answerKeyOf,
  gradingSettingsOf,
  isSameAnswerKey,
  isScoringModeOf,
  scoringModesOf,
} from '../answer-key';

const STORED_MARGIN: Margin = { value: 5, unit: 'absolute' };
const STORED_MODE: ScoringMode = 'exact';

/** What each setting resolves to for a type that carries it, with none stored. */
const defaultsOf = (type: QuestionType) => ({
  scoringMode: type === 'sort' ? 'one_off' : 'per_item',
  margin: DEFAULT_MARGIN,
});

/** What each setting resolves to for a type that carries it, once stored. */
const STORED = {
  scoringMode: STORED_MODE,
  margin: STORED_MARGIN,
};

function carried(type: QuestionType): readonly string[] {
  return QUESTION_KINDS[type].gradingSettings;
}

function pick(
  source: Record<string, unknown>,
  names: readonly string[],
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(source).filter(([name]) => names.includes(name)),
  );
}

function key(type: QuestionType, overrides: Record<string, unknown> = {}) {
  return answerKeyOf({ type, answer: '42', points: 2, ...overrides });
}

describe.each(QUESTION_TYPES)(
  'the grading settings of a %s question',
  (type) => {
    it('are the type defaults when none are stored', () => {
      expect(gradingSettingsOf({ type })).toEqual(
        pick(defaultsOf(type), carried(type)),
      );
    });

    it('are the stored values when stored', () => {
      expect(gradingSettingsOf({ type, ...STORED })).toEqual(
        pick(STORED, carried(type)),
      );
    });

    it('drop a setting the type does not carry', () => {
      const settings = gradingSettingsOf({ type, ...STORED });

      expect(Object.keys(settings).sort()).toEqual([...carried(type)].sort());
    });
  },
);

describe('the scoring modes a type accepts', () => {
  it.each([
    ['sort', ['one_off', 'exact', 'per_item']],
    ['match', ['per_item', 'one_off']],
    ['number', []],
    ['free_text', []],
  ] as const)('%s accepts %j', (type, modes) => {
    expect(scoringModesOf(type)).toEqual(modes);
  });

  it('tells an accepted mode from an unset or foreign one', () => {
    expect(isScoringModeOf('sort', 'exact')).toBe(true);
    expect(isScoringModeOf('match', 'exact')).toBe(false);
    expect(isScoringModeOf('sort', undefined)).toBe(false);
    expect(isScoringModeOf('number', 'per_item')).toBe(false);
  });

  it('defaults a sort question to one_off and a match question to per_item', () => {
    expect(gradingSettingsOf({ type: 'sort' }).scoringMode).toBe('one_off');
    expect(gradingSettingsOf({ type: 'match' }).scoringMode).toBe('per_item');
  });
});

describe('the answer key of a question', () => {
  it('holds the answer, the points and the resolved settings', () => {
    expect(key('number')).toEqual({
      answer: '42',
      points: 2,
      margin: DEFAULT_MARGIN,
    });
    expect(key('free_text')).toEqual({ answer: '42', points: 2 });
  });
});

describe('whether two answer keys are the same', () => {
  describe.each(QUESTION_TYPES)('for a %s question', (type) => {
    it('is the same when a setting is unset in one and the default in the other', () => {
      expect(
        isSameAnswerKey(
          key(type),
          key(type, pick(defaultsOf(type), carried(type))),
        ),
      ).toBe(true);
    });

    it('differs when the answer differs', () => {
      expect(isSameAnswerKey(key(type), key(type, { answer: '43' }))).toBe(
        false,
      );
    });

    it('differs when the points differ', () => {
      expect(isSameAnswerKey(key(type), key(type, { points: 3 }))).toBe(false);
    });

    it.each(['scoringMode', 'margin'] as const)(
      'treats a differing %s as a difference only if the type carries it',
      (name) => {
        const isCarried = carried(type).includes(name);

        expect(
          isSameAnswerKey(key(type), key(type, { [name]: STORED[name] })),
        ).toBe(!isCarried);
      },
    );
  });

  it('is the same for a margin with its fields in another order', () => {
    expect(
      isSameAnswerKey(
        key('number', { margin: { value: 5, unit: 'absolute' } }),
        key('number', { margin: { unit: 'absolute', value: 5 } }),
      ),
    ).toBe(true);
  });

  it('differs for a margin with another value or unit', () => {
    const base = key('number', { margin: STORED_MARGIN });

    expect(
      isSameAnswerKey(
        base,
        key('number', { margin: { value: 6, unit: 'absolute' } }),
      ),
    ).toBe(false);
    expect(
      isSameAnswerKey(
        base,
        key('number', { margin: { value: 5, unit: 'percent' } }),
      ),
    ).toBe(false);
  });
});
