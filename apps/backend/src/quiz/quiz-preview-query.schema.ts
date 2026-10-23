import { z } from 'zod';
import {
  DEFAULT_QUIZ_PREVIEW_MODE,
  QUIZ_PREVIEW_MODES,
} from '@campus-pubquiz/types';

export const quizPreviewQuerySchema = z.object({
  mode: z.enum(QUIZ_PREVIEW_MODES).default(DEFAULT_QUIZ_PREVIEW_MODE),
  // Off unless asked for; only the night order has a joker pick to add.
  jokers: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});
