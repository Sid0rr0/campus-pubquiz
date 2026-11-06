import { z } from 'zod';
import {
  MAX_TEAMS_SEARCH_LENGTH,
  TEAMS_SORT_COLUMNS,
} from '@campus-pubquiz/types';

const DEFAULT_TEAMS_PAGE_SIZE = 20;
const MAX_TEAMS_PAGE_SIZE = 100;

export const teamsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_TEAMS_PAGE_SIZE)
    .default(DEFAULT_TEAMS_PAGE_SIZE),
  sortBy: z.enum(TEAMS_SORT_COLUMNS).default('joinedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().trim().max(MAX_TEAMS_SEARCH_LENGTH).optional(),
  showQuickfireOnly: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

export type TeamsQuery = z.infer<typeof teamsQuerySchema>;
