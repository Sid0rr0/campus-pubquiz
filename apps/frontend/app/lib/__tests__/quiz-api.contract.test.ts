import {
  BASE,
  CSRF,
  describeApiClient,
} from '@/app/lib/__tests__/api-client-contract';
import { deleteQuiz, fetchQuizzes, QuizApiError } from '@/app/lib/quiz-api';

describeApiClient(
  'quiz-api',
  QuizApiError,
  'QuizApiError',
  [
    {
      name: 'fetchQuizzes',
      call: () => fetchQuizzes(),
      url: `${BASE}/quizzes`,
      init: { credentials: 'include' },
      fallback: 'Could not load quizzes',
      okBody: { quizzes: [] },
    },
    {
      name: 'fetchQuizzes (for a join code)',
      call: () => fetchQuizzes('AB CD'),
      url: `${BASE}/quizzes?joinCode=AB%20CD`,
      init: { credentials: 'include' },
      fallback: 'Could not load quizzes',
      okBody: { quizzes: [] },
    },
    {
      name: 'deleteQuiz',
      call: () => deleteQuiz(6),
      url: `${BASE}/quizzes/6`,
      init: { method: 'DELETE', credentials: 'include', headers: CSRF },
      fallback: 'Could not delete quiz',
      expected: undefined,
    },
  ],
  { toleratesBadJson: false },
);
