import type { SessionDetailStats } from '@campus-pubquiz/types';

type RoundRating = SessionDetailStats['rounds'][number]['rating'];

function formatRating(rating: RoundRating): string {
  if (!rating) return '—';
  const teams = rating.count === 1 ? 'team' : 'teams';
  return `★ ${rating.average.toFixed(1)} · ${rating.count} ${teams}`;
}

interface RoundsTableProps {
  rounds: SessionDetailStats['rounds'];
  hardestRoundId: number | null;
}

export function RoundsTable({ rounds, hardestRoundId }: RoundsTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-foreground/15">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-foreground/15 bg-foreground/5">
            <th className="px-4 py-2 font-display text-sm text-foreground/70">
              Round
            </th>
            <th className="px-4 py-2 font-display text-sm text-foreground/70">
              Category
            </th>
            <th className="px-4 py-2 font-display text-sm text-foreground/70">
              Correct rate
            </th>
            <th className="px-4 py-2 font-display text-sm text-foreground/70">
              Points earned
            </th>
            <th className="px-4 py-2 font-display text-sm text-foreground/70">
              Rating
            </th>
          </tr>
        </thead>
        <tbody>
          {rounds.length === 0 ? (
            <tr>
              <td
                colSpan={5}
                className="px-4 py-3 text-center text-foreground/50"
              >
                No rounds in this quiz.
              </td>
            </tr>
          ) : (
            rounds.map((round) => (
              <tr
                key={round.roundId}
                className={[
                  'border-b border-foreground/10 last:border-b-0',
                  round.roundId === hardestRoundId ? 'bg-magenta/10' : '',
                ].join(' ')}
              >
                <td className="px-4 py-2">
                  {round.title}
                  {round.roundId === hardestRoundId && (
                    <span className="ml-2 rounded-full bg-magenta px-2 py-0.5 text-xs font-extrabold text-white">
                      Hardest
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">{round.category ?? '—'}</td>
                <td className="px-4 py-2">
                  {(round.correctRate * 100).toFixed(0)}%
                </td>
                <td className="px-4 py-2">{round.pointsPercent.toFixed(0)}%</td>
                <td className="px-4 py-2">{formatRating(round.rating)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
