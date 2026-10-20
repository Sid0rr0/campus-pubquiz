import { z } from 'zod';
import {
  DEFAULT_QUIZ_PREVIEW_MODE,
  QUIZ_PREVIEW_MODES,
} from '@campus-pubquiz/types';

export const quizPreviewQuerySchema = z.object({
  mode: z.enum(QUIZ_PREVIEW_MODES).default(DEFAULT_QUIZ_PREVIEW_MODE),
});
