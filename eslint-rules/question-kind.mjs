// Mechanical halves of two CLAUDE.md constraints, shared by the backend and
// frontend ESLint configs. Test files are exempt: fixtures are built per type.

/**
 * Mirrors QUESTION_TYPES (shared/types/src/question-types.ts). ESLint can't
 * import the TypeScript source, so a shared/types test keeps the two equal.
 */
export const QUESTION_TYPE_LITERALS = [
  'multiple_choice',
  'free_text',
  'audio',
  'youtube',
  'sort',
  'match',
  'closest_guess',
];

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
