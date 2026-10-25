import {
  SESSION_SCALE_VALUES,
  type SessionScale,
  type SessionScaleCounts,
} from '@campus-pubquiz/types';
import type {
  SessionDetailFeedback,
  SessionDetailFeedbackTopic,
  SessionDetailRoundRating,
} from '@campus-pubquiz/types';
import type {
  SessionDetailFeedbackInputRow,
  SessionDetailRoundRatingInputRow,
} from '@/stats/session-detail.calc';

/** Same topic regardless of capitals and spaces: trimmed, inner whitespace collapsed, lower-cased. */
function topicKey(topic: string): string {
  // Stryker disable next-line MethodExpression,Regex: the only caller passes a topic cleanTopic already trimmed and collapsed, and the key is only compared, so upper-casing it or re-trimming changes nothing.
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
      // Stryker disable next-line StringLiteral: every group holds a spelling with count >= 1, so the first iteration always replaces this seed.
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

/** The Session rating: the per-round averages weighted by their counts, so each rating counts once. */
function sessionRating(
  roundRatings: readonly SessionDetailRoundRatingInputRow[],
): SessionDetailRoundRating | null {
  const count = roundRatings.reduce((sum, r) => sum + r.count, 0);
  if (count === 0) return null;
  const stars = roundRatings.reduce((sum, r) => sum + r.average * r.count, 0);
  return { average: stars / count, count };
}

/** How many teams gave each answer on one scale, every answer present in scale order; teams that gave none are not counted. */
function scaleCounts<S extends SessionScale>(
  scale: S,
  rows: readonly SessionDetailFeedbackInputRow[],
): SessionScaleCounts<S> {
  const values: readonly string[] = SESSION_SCALE_VALUES[scale];
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = 0;
  for (const row of rows) {
    const value: string | null | undefined = row[scale];
    if (value) counts[value] += 1;
  }
  return counts as SessionScaleCounts<S>;
}

export interface SessionFeedbackInput {
  /** The session's "Collect feedback" setting. */
  isCollected: boolean;
  /** Each team's comment and topics, oldest first. */
  rows: readonly SessionDetailFeedbackInputRow[];
  /** One row per rated round. */
  roundRatings: readonly SessionDetailRoundRatingInputRow[];
}

/** The anonymous feedback section: newest comments first, empty ones skipped, topics grouped, the Session rating. */
export function computeSessionFeedback({
  isCollected,
  rows,
  roundRatings,
}: SessionFeedbackInput): SessionDetailFeedback {
  if (!isCollected) {
    return {
      collected: false,
      comments: [],
      topics: [],
      rating: null,
      pacing: scaleCounts('pacing', []),
      feltDifficulty: scaleCounts('feltDifficulty', []),
    };
  }

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
    rating: sessionRating(roundRatings),
    pacing: scaleCounts('pacing', rows),
    feltDifficulty: scaleCounts('feltDifficulty', rows),
  };
}
