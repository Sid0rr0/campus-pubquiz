import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM config module, no type declarations
import {
  QUESTION_TYPE_LITERALS,
  readQuestionTypes,
} from '../../../../eslint-rules/question-kind.mjs';
import { QUESTION_TYPES } from '../question-types';

function moduleWith(source: string): string {
  const path = join(mkdtempSync(join(tmpdir(), 'question-kind-')), 'types.ts');
  writeFileSync(path, source);
  return path;
}

describe('ESLint question-kind rules', () => {
  it('ban comparisons against exactly the registry question types', () => {
    expect([...(QUESTION_TYPE_LITERALS as string[])]).toEqual([
      ...QUESTION_TYPES,
    ]);
  });

  it('throws naming the module when it has no type list', () => {
    const path = moduleWith('export const OTHER = [1, 2];\n');
    expect(() => readQuestionTypes(path)).toThrow(path);
  });

  it('throws naming the module when an element is not a plain string', () => {
    const path = moduleWith(
      "const x = 'a';\nexport const QUESTION_TYPES = ['a', x] as const;\n",
    );
    expect(() => readQuestionTypes(path)).toThrow(path);
  });

  it('throws naming the module when the module cannot be read', () => {
    const path = join(tmpdir(), 'question-kind-missing', 'nope.ts');
    expect(() => readQuestionTypes(path)).toThrow(path);
  });

  it('throws when the list is empty', () => {
    const path = moduleWith('export const QUESTION_TYPES = [] as const;\n');
    expect(() => readQuestionTypes(path)).toThrow(path);
  });
});
