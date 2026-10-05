import type {
  SessionDetailFeedback,
  SessionDetailFeedbackTopic,
} from '@campus-pubquiz/types';
import type { SessionDetailFeedbackInputRow } from '@/stats/session-detail.calc';

/** Same topic regardless of capitals and spaces: trimmed, inner whitespace collapsed, lower-cased. */
function topicKey(topic: string): string {
  return topic.trim().replace(/\s+/g, ' ').toLowerCase();
}

function cleanTopic(topic: string): string {
  return topic.trim().replace(/\s+/g, ' ');
}

/** Groups topics given oldest first; a group shows its most common spelling, the earliest-submitted on a tie. */
export function groupTopics(
  submissions: readonly string[][],
): SessionDetailFeedbackTopic[] {
  const groups = new Map<string, Map<string, number>>();
  for (const topic of submissions.flat().map(cleanTopic)) {
    if (topic === '') continue;
    const key = topicKey(topic);
    const spellings = groups.get(key) ?? new Map<string, number>();
    spellings.set(topic, (spellings.get(topic) ?? 0) + 1);
    groups.set(key, spellings);
  }

  return [...groups.values()]
    .map((spellings) => {
      let best = '';
      let bestCount = 0;
      let count = 0;
      // Map iteration is insertion order, so a strict > keeps the first-submitted on a tie.
      for (const [spelling, spellingCount] of spellings) {
        count += spellingCount;
        if (spellingCount > bestCount) {
          best = spelling;
          bestCount = spellingCount;
        }
      }
      return { topic: best, count };
    })
    .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic));
}

/** The anonymous feedback section: newest comments first, empty ones skipped, topics grouped. */
export function computeSessionFeedback(
  isCollected: boolean,
  rows: readonly SessionDetailFeedbackInputRow[],
): SessionDetailFeedback {
  if (!isCollected) return { collected: false, comments: [], topics: [] };

  const comments = rows
    .filter((row) => row.comment.trim() !== '')
    .map((row) => ({
      text: row.comment,
      submittedAt: new Date(row.submittedAt).toISOString(),
    }))
    .reverse();

  return {
    collected: true,
    comments,
    topics: groupTopics(rows.map((row) => row.topics)),
  };
}
