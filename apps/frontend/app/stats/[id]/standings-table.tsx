import type { SessionDetailStats } from '@campus-pubquiz/types';
import { formatRankLabel } from '@/app/lib/rank-label';
import { formatResponseMs } from '@/app/stats/[id]/format-response-ms';

interface StandingsTableProps {
  standings: SessionDetailStats['standings'];
}

export function StandingsTable({ standings }: StandingsTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-foreground/15">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-foreground/15 bg-foreground/5">
            <th className="px-4 py-2 font-display text-sm text-foreground/70">
              Rank
            </th>
            <th className="px-4 py-2 font-display text-sm text-foreground/70">
              Team
            </th>
            <th className="px-4 py-2 font-display text-sm text-foreground/70">
              Answer points
            </th>
            <th className="px-4 py-2 font-display text-sm text-foreground/70">
              Bonus
            </th>
            <th className="px-4 py-2 font-display text-sm text-foreground/70">
              Total
            </th>
            <th className="px-4 py-2 font-display text-sm text-foreground/70">
              Correct
            </th>
            <th className="px-4 py-2 font-display text-sm text-foreground/70">
              Avg response
            </th>
          </tr>
        </thead>
        <tbody>
          {standings.length === 0 ? (
            <tr>
              <td
                colSpan={7}
                className="px-4 py-3 text-center text-foreground/50"
              >
                No teams joined this session.
              </td>
            </tr>
          ) : (
            standings.map((team) => (
              <tr
                key={team.teamId}
                className={`border-b border-foreground/10 last:border-b-0 ${team.isWinner ? 'bg-yellow/20 font-bold' : ''} ${team.hasLeft ? 'text-foreground/50' : ''}`}
              >
                <td className="px-4 py-2">
                  {team.rank === null || team.rankTo === null
                    ? 'left'
                    : formatRankLabel({ rank: team.rank, rankTo: team.rankTo })}
                </td>
                <td className="px-4 py-2">
                  {team.teamName}
                  {team.isWinner && (
                    <span className="ml-2 rounded-full bg-yellow px-2 py-0.5 text-xs">
                      Winner
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">{team.answerPoints}</td>
                <td className="px-4 py-2">{team.bonusPoints}</td>
                <td className="px-4 py-2 font-extrabold">{team.total}</td>
                <td className="px-4 py-2">{team.correctCount}</td>
                <td className="px-4 py-2">
                  {formatResponseMs(team.avgResponseMs)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
