import {
  BASE,
  describeApiClient,
} from '@/app/lib/__tests__/api-client-contract';
import {
  fetchQuizPreview,
  QuizPreviewApiError,
} from '@/app/lib/quiz-preview-api';

describeApiClient(
  'quiz-preview-api',
  QuizPreviewApiError,
  'QuizPreviewApiError',
  [
    {
      name: 'fetchQuizPreview (no jokers)',
      call: () => fetchQuizPreview(6, 'night', false),
      url: `${BASE}/quizzes/6/preview?mode=night`,
      init: { credentials: 'include' },
      fallback: 'Could not load the quiz preview',
      okBody: { frames: [] },
    },
    {
      name: 'fetchQuizPreview (with jokers)',
      call: () => fetchQuizPreview(6, 'answer_after_question', true),
      url: `${BASE}/quizzes/6/preview?mode=answer_after_question&jokers=true`,
      init: { credentials: 'include' },
      fallback: 'Could not load the quiz preview',
      okBody: { frames: [] },
    },
  ],
  { toleratesBadJson: true },
);
