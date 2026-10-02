import {
  MAX_FEEDBACK_COMMENT_LENGTH,
  MAX_FEEDBACK_TOPICS,
  MAX_FEEDBACK_TOPIC_LENGTH,
  type SendFeedbackPayload,
} from '@campus-pubquiz/types';

/** What a topic line list becomes when sent: trimmed, with empty and whitespace-only lines dropped. */
export function cleanTopics(lines: readonly string[]): string[] {
  return lines.map((line) => line.trim()).filter((line) => line !== '');
}

/** What the form checks before Send, in plain words: the same limits the server enforces. Empty when the draft can be sent. */
export function findDraftProblems(draft: SendFeedbackPayload): string[] {
  const problems: string[] = [];
  if (draft.comment.length > MAX_FEEDBACK_COMMENT_LENGTH) {
    problems.push(
      `Your comment is ${draft.comment.length} characters — the limit is ${MAX_FEEDBACK_COMMENT_LENGTH} characters.`,
    );
  }
  draft.topics.forEach((line, index) => {
    if (line.trim().length > MAX_FEEDBACK_TOPIC_LENGTH) {
      problems.push(
        `Topic ${index + 1} is too long — the limit is ${MAX_FEEDBACK_TOPIC_LENGTH} characters.`,
      );
    }
  });
  if (cleanTopics(draft.topics).length > MAX_FEEDBACK_TOPICS) {
    problems.push(`Suggest up to ${MAX_FEEDBACK_TOPICS} topics.`);
  }
  return problems;
}
