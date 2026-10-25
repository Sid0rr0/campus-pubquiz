import {
  SESSION_SCALE_VALUES,
  type FeedbackTrends,
  type SessionScale,
  type SessionScaleCounts,
} from '@campus-pubquiz/types';

interface RatingsOverTimeTableProps {
  sessions: FeedbackTrends['sessions'];
}

/** Counts in scale order ("2 · 7 · 1"), or a dash when nobody answered. */
function scaleCountsText<S extends SessionScale>(
  scale: S,
  counts: SessionScaleCounts<S>,
): string {
  const values = SESSION_SCALE_VALUES[
    scale
  ] as readonly (keyof typeof counts)[];
  const ordered = values.map((value) => counts[value]);
  return ordered.every((n) => n === 0) ? '—' : ordered.join(' · ');
}

/** Each ended session's average round rating, oldest to newest. A session nobody rated shows a dash, never zero. */
export function RatingsOverTimeTable({ sessions }: RatingsOverTimeTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-foreground/15">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-foreground/15 bg-foreground/5">
            <th className="px-4 py-2 font-display text-sm text-foreground/70">
              Session
            </th>
            <th className="px-4 py-2 font-display text-sm text-foreground/70">
              Date
            </th>
            <th className="px-4 py-2 font-display text-sm text-foreground/70">
              Average rating
            </th>
            <th className="px-4 py-2 font-display text-sm text-foreground/70">
              Ratings
            </th>
            <th className="px-4 py-2 font-display text-sm text-foreground/70">
              Pacing
            </th>
            <th className="px-4 py-2 font-display text-sm text-foreground/70">
              Felt difficulty
            </th>
          </tr>
        </thead>
        <tbody>
          {sessions.length === 0 ? (
            <tr>
              <td
                colSpan={6}
                className="px-4 py-3 text-center text-foreground/50"
              >
                No finished sessions with feedback in this range.
              </td>
            </tr>
          ) : (
            sessions.map((session) => (
              <tr
                key={session.id}
                className="border-b border-foreground/10 last:border-b-0"
              >
                <td className="px-4 py-2">{session.name}</td>
                <td className="px-4 py-2">
                  {new Date(session.date).toLocaleDateString()}
                </td>
                <td className="px-4 py-2">
                  {session.rating
                    ? `★ ${session.rating.average.toFixed(1)}`
                    : '—'}
                </td>
                <td className="px-4 py-2">{session.rating?.count ?? '—'}</td>
                <td className="px-4 py-2">
                  {scaleCountsText('pacing', session.pacing)}
                </td>
                <td className="px-4 py-2">
                  {scaleCountsText('feltDifficulty', session.feltDifficulty)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
