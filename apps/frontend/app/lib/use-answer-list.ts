'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AnswersUpdatedPayload } from '@campus-pubquiz/types';
import { fetchAnswers, AnswerApiError } from '@/app/lib/answer-api';
import { apiErrorMessage } from '@/app/lib/api-error-message';
import { queryKeys } from '@/app/lib/query-keys';
import { useToastOnError } from '@/app/lib/use-toast-on-error';

/**
 * One question's Answer list (the question plus every team's answer and
 * grade), or null while there's no question, the first read is loading or it
 * failed. The REST read fills the shared query cache entry; the admin game
 * hook's ANSWERS_UPDATED listener writes broadcasts into the same entry and
 * re-reads on a reconnect.
 */
export function useAnswerList(
  joinCode: string | undefined,
  questionId: number | null,
): AnswersUpdatedPayload | null {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.answers.forQuestion(joinCode ?? '', questionId ?? -1),
    queryFn: async ({ queryKey }) => {
      const before = queryClient.getQueryData(queryKey);
      const read = await fetchAnswers(joinCode as string, questionId as number);
      // A broadcast that landed while the read was in flight is newer.
      const now = queryClient.getQueryData<AnswersUpdatedPayload>(queryKey);
      return now !== before && now ? now : read;
    },
    enabled: Boolean(joinCode) && questionId !== null,
    // Transient, request-driven data: drop it once nobody shows the question.
    gcTime: 0,
  });
  useToastOnError(
    apiErrorMessage(query.error, AnswerApiError, 'Could not load answers'),
  );
  return query.data ?? null;
}
