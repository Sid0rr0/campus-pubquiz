import { describe, expect, it } from 'vitest';
import {
  FELT_DIFFICULTY_VALUES,
  PACING_VALUES,
  SESSION_SCALE_VALUES,
  rateSessionPayloadSchema,
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
