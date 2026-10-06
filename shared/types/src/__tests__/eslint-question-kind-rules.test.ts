import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM config module, no type declarations
import { QUESTION_TYPE_LITERALS } from '../../../../eslint-rules/question-kind.mjs';
import { QUESTION_TYPES } from '../question-types';

describe('ESLint question-kind rules', () => {
  it('ban comparisons against exactly the registry question types', () => {
    expect([...(QUESTION_TYPE_LITERALS as string[])].sort()).toEqual(
      [...QUESTION_TYPES].sort(),
    );
  });
});
