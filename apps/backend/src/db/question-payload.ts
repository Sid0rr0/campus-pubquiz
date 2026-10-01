import { Logger } from '@nestjs/common';
import {
  parseQuestionPayload,
  type QuestionPayload,
  type QuestionType,
} from '@campus-pubquiz/types';

const logger = new Logger('QuestionPayload');

/**
 * Reads a question row's stored payload through its kind's codec. A malformed
 * or old row is logged with the question's id and rethrown, so it fails when
 * the quiz loads or is edited rather than midway through a live game.
 */
export function readQuestionPayload(row: {
  id: number;
  type: QuestionType;
  payload: unknown;
}): QuestionPayload {
  try {
    return parseQuestionPayload(row.type, row.payload);
  } catch (error) {
    logger.error(
      `Question ${row.id} has an unreadable ${row.type} payload`,
      error instanceof Error ? error.stack : String(error),
    );
    throw error;
  }
}
