/**
 * Single source of truth for every React Query key in the app. Invalidation
 * crosses component boundaries (starting a session from /sessions must
 * refresh the public list /display and /play read), so keys cannot live next
 * to their consumers.
 *
 * Prefix rule: invalidating a namespace's `all` key invalidates every key
 * built beneath it.
 */
export const queryKeys = {
  auth: {
    all: ['auth'] as const,
    me: () => ['auth', 'me'] as const,
  },
  users: {
    all: ['users'] as const,
    list: () => ['users', 'list'] as const,
  },
  quizzes: {
    all: ['quizzes'] as const,
    // `null` (not `undefined`) for the unscoped list, so the key is
    // JSON-stable across calls with and without a joinCode.
    list: (joinCode?: string) => ['quizzes', 'list', joinCode ?? null] as const,
    draft: (quizId: number) => ['quizzes', 'draft', quizId] as const,
  },
  sessions: {
    all: ['sessions'] as const,
    list: () => ['sessions', 'list'] as const,
    public: () => ['sessions', 'public'] as const,
  },
  // A top-level namespace rather than ['sessions', code, 'answers', id]:
  // answers are transient per-question data, and nesting them under
  // 'sessions' would mean every createSession/closeSession invalidation also
  // blew away the admin's in-progress grading answers.
  answers: {
    all: ['answers'] as const,
    forQuestion: (joinCode: string, questionId: number) =>
      ['answers', joinCode, questionId] as const,
  },
} as const;
