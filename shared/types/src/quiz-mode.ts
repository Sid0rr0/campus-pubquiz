/** A quiz's mode, chosen at creation and never changed: see GLOSSARY.md "quiz mode". */
export const QUIZ_MODES = ['pub', 'quickfire'] as const;

export type QuizMode = (typeof QUIZ_MODES)[number];
