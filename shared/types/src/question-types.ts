/**
 * The single list of question types. Every workspace imports it; the
 * `QuestionType` union is derived from it, and the Question kind registry
 * (question-kind.ts) is keyed by it so a type without an entry fails to compile.
 * Its order is the quiz editor's type-picker order.
 */
export const QUESTION_TYPES = [
  'multiple_choice',
  'free_text',
  'audio',
  'youtube',
  'sort',
  'match',
  'closest_guess',
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];
