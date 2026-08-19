import type {
  ImportQuestionPreview,
  ImportRoundPreview,
  QuizDraftSaveRequest,
} from '@campus-pubquiz/types';

export function makeQuestion(
  overrides: Partial<ImportQuestionPreview> = {},
): ImportQuestionPreview {
  return {
    type: 'free_text',
    prompt: 'Largest planet?',
    answer: 'Jupiter',
    points: 2,
    ...overrides,
  };
}

export function makeRound(
  overrides: Partial<ImportRoundPreview> = {},
): ImportRoundPreview {
  return {
    title: 'Round 1',
    breakAfter: true,
    questions: [makeQuestion()],
    ...overrides,
  };
}

export function makeRequest(
  overrides: Partial<QuizDraftSaveRequest> = {},
): QuizDraftSaveRequest {
  return {
    title: 'Trivia Night',
    rounds: [makeRound()],
    ...overrides,
  };
}
