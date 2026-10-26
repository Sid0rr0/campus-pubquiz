import {
  BASE,
  describeApiClient,
} from '@/app/lib/__tests__/api-client-contract';
import { AnswerApiError, fetchAnswers } from '@/app/lib/answer-api';

describeApiClient(
  'answer-api',
  AnswerApiError,
  'AnswerApiError',
  [
    {
      name: 'fetchAnswers',
      call: () => fetchAnswers('ABCD', 12),
      url: `${BASE}/sessions/ABCD/answers/12`,
      init: { credentials: 'include' },
      fallback: 'Could not load answers',
      okBody: { questionId: 12, answers: [] },
    },
  ],
  { toleratesBadJson: false },
);
