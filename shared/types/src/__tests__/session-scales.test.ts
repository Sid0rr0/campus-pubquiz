import { describe, expect, it } from 'vitest';
import {
  FELT_DIFFICULTY_VALUES,
  PACING_VALUES,
  SESSION_SCALE_VALUES,
  rateSessionPayloadSchema,
  sessionScaleEntries,
} from '../index';

describe('the session scales', () => {
  it('lists pacing from too slow to too fast', () => {
    expect(PACING_VALUES).toEqual(['too_slow', 'just_right', 'too_fast']);
  });

  it('lists felt difficulty from too easy to too hard', () => {
    expect(FELT_DIFFICULTY_VALUES).toEqual([
      'too_easy',
      'just_right',
      'too_hard',
    ]);
  });

  it('names each scale with its values in order', () => {
    expect(SESSION_SCALE_VALUES).toEqual({
      pacing: ['too_slow', 'just_right', 'too_fast'],
      feltDifficulty: ['too_easy', 'just_right', 'too_hard'],
    });
  });
});

describe('rateSessionPayloadSchema', () => {
  it.each([
    { scale: 'pacing', value: 'too_slow' },
    { scale: 'pacing', value: 'just_right' },
    { scale: 'pacing', value: 'too_fast' },
    { scale: 'feltDifficulty', value: 'too_easy' },
    { scale: 'feltDifficulty', value: 'just_right' },
    { scale: 'feltDifficulty', value: 'too_hard' },
  ])('accepts $scale = $value', (payload) => {
    expect(rateSessionPayloadSchema.parse(payload)).toEqual(payload);
  });

  it.each([
    [
      'a pacing value on felt difficulty',
      { scale: 'feltDifficulty', value: 'too_slow' },
    ],
    [
      'a felt-difficulty value on pacing',
      { scale: 'pacing', value: 'too_hard' },
    ],
    ['an unknown scale', { scale: 'mood', value: 'just_right' }],
    ['a missing value', { scale: 'pacing' }],
    [
      'a null value (an answer cannot be cleared)',
      { scale: 'pacing', value: null },
    ],
    ['a value in another case', { scale: 'pacing', value: 'Too slow' }],
  ])('refuses %s', (_name, payload) => {
    expect(rateSessionPayloadSchema.safeParse(payload).success).toBe(false);
  });
});

describe('sessionScaleEntries', () => {
  it('pairs each count with its value and label in scale order', () => {
    expect(
      sessionScaleEntries('pacing', {
        too_fast: 1,
        too_slow: 3,
        just_right: 2,
      }),
    ).toEqual([
      { value: 'too_slow', label: 'Too slow', count: 3 },
      { value: 'just_right', label: 'Just right', count: 2 },
      { value: 'too_fast', label: 'Too fast', count: 1 },
    ]);
  });

  it('follows the felt difficulty scale for that scale', () => {
    expect(
      sessionScaleEntries('feltDifficulty', {
        too_hard: 0,
        too_easy: 4,
        just_right: 0,
      }).map((entry) => [entry.label, entry.count]),
    ).toEqual([
      ['Too easy', 4],
      ['Just right', 0],
      ['Too hard', 0],
    ]);
  });
});
