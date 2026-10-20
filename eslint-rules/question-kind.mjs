// Mechanical halves of two CLAUDE.md constraints, shared by the backend and
// frontend ESLint configs. Test files are exempt: fixtures are built per type.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const QUESTION_TYPES_MODULE = fileURLToPath(
  new URL('../shared/types/src/question-types.ts', import.meta.url),
);

// The TypeScript ESLint parser is a dependency of the backend workspace; resolve
// it from there so this root-level module needs no dependency of its own.
const requireFromBackend = createRequire(
  new URL('../apps/backend/package.json', import.meta.url),
);

/**
 * Reads the elements of the `QUESTION_TYPES` array literal from a TypeScript
 * module. ESLint can't import TypeScript source, so the module is parsed.
 * Throws (naming the module) rather than ever returning an empty list, so a
 * moved or reshaped list can't silently switch the rule off.
 */
export function readQuestionTypes(modulePath = QUESTION_TYPES_MODULE) {
  const fail = (reason) => {
    throw new Error(
      `ESLint question-kind rules: cannot read QUESTION_TYPES from ${modulePath}: ${reason}`,
    );
  };

  let ast;
  try {
    const { parser } = requireFromBackend('typescript-eslint');
    ast = parser.parseForESLint(readFileSync(modulePath, 'utf8')).ast;
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }

  for (const statement of ast.body) {
    const declaration =
      statement.type === 'ExportNamedDeclaration'
        ? statement.declaration
        : statement;
    if (declaration?.type !== 'VariableDeclaration') continue;
    for (const declarator of declaration.declarations) {
      if (declarator.id.name !== 'QUESTION_TYPES') continue;
      let list = declarator.init;
      while (list?.type === 'TSAsExpression') list = list.expression;
      if (list?.type !== 'ArrayExpression') {
        return fail('QUESTION_TYPES is not an array literal');
      }
      const types = list.elements.map((element) =>
        element?.type === 'Literal' && typeof element.value === 'string'
          ? element.value
          : null,
      );
      if (types.length === 0) return fail('QUESTION_TYPES is empty');
      if (types.includes(null)) {
        return fail('QUESTION_TYPES has an element that is not a plain string');
      }
      return types;
    }
  }
  return fail('no QUESTION_TYPES declaration found');
}

/** The shared type list (shared/types/src/question-types.ts), parsed when the config loads. */
export const QUESTION_TYPE_LITERALS = readQuestionTypes();

const TYPE_LITERAL = `/^(${QUESTION_TYPE_LITERALS.join('|')})$/`;
const EQUALITY = 'BinaryExpression[operator=/^[!=]==?$/]';
const TYPE_LITERAL_MESSAGE =
  "Don't compare a question type against a literal; read the behaviour from the question type registry (QUESTION_KINDS or a helper in shared/types/src/scoring.ts).";

/** `question.type === 'free_text'`, `type !== 'sort'`, either side, and `switch (x.type) { case 'match': }`. */
const typeLiteralComparisons = [
  `${EQUALITY}[left.property.name='type'][right.value=${TYPE_LITERAL}]`,
  `${EQUALITY}[right.property.name='type'][left.value=${TYPE_LITERAL}]`,
  `${EQUALITY}[left.name='type'][right.value=${TYPE_LITERAL}]`,
  `${EQUALITY}[right.name='type'][left.value=${TYPE_LITERAL}]`,
  `SwitchStatement[discriminant.property.name='type'] > SwitchCase[test.value=${TYPE_LITERAL}]`,
  `SwitchStatement[discriminant.name='type'] > SwitchCase[test.value=${TYPE_LITERAL}]`,
].map((selector) => ({ selector, message: TYPE_LITERAL_MESSAGE }));

const PAYLOAD_CAST_MESSAGE =
  'Stored question payloads are parsed, never cast: use parseQuestionPayload (apps/backend/src/db/question-payload.ts).';

/** `row.payload as X` and `as QuestionPayload` anywhere, including through `as unknown`. */
const payloadCasts = [
  "TSAsExpression[expression.type='MemberExpression'][expression.property.name='payload']",
  'TSAsExpression[typeAnnotation.typeName.name=/QuestionPayload$/]',
].map((selector) => ({ selector, message: PAYLOAD_CAST_MESSAGE }));

const TEST_FILES = [
  '**/*.spec.ts',
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/__tests__/**',
  'test/**',
];

/** Flat-config block banning question-type literal comparisons (and, with `withPayloadCasts`, stored-payload casts). */
export function questionKindRules({ withPayloadCasts = false } = {}) {
  return {
    ignores: TEST_FILES,
    rules: {
      'no-restricted-syntax': [
        'error',
        ...typeLiteralComparisons,
        ...(withPayloadCasts ? payloadCasts : []),
      ],
    },
  };
}
