import { z } from 'zod';
import { PLAYED_SESSIONS_SORT_COLUMNS } from '@campus-pubquiz/types';

const DEFAULT_SESSIONS_PAGE_SIZE = 20;
const MAX_SESSIONS_PAGE_SIZE = 100;
const MAX_SESSION_NAME_LENGTH = 200;

export const playedSessionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_SESSIONS_PAGE_SIZE)
    .default(DEFAULT_SESSIONS_PAGE_SIZE),
  sortBy: z.enum(PLAYED_SESSIONS_SORT_COLUMNS).default('playedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type PlayedSessionsQuery = z.infer<typeof playedSessionsQuerySchema>;

// A blank name (after trim) is valid on purpose — it clears the custom name,
// falling StatsService.renameSession back to the session's quiz title.
export const renameSessionSchema = z.object({
  name: z.string().trim().max(MAX_SESSION_NAME_LENGTH),
});

export type RenameSessionBody = z.infer<typeof renameSessionSchema>;
