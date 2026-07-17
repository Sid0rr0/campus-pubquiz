import type { LeaderboardEntry } from '@campus-pubquiz/types';

interface LeaderboardProps {
  entries: LeaderboardEntry[];
}

const RANK_ACCENT_CLASSES = ['text-magenta', 'text-cyan', 'text-green'];

function rowClasses(rank: number): string {
  if (rank === 0) {
    return 'flex items-center gap-4 rounded-xl border-[3px] border-magenta bg-white px-5 py-3 shadow-[0_3px_0_#ec008c]';
  }
  if (rank < 3) {
    return 'flex items-center gap-4 rounded-xl border-2 border-dark-blue/25 bg-white px-5 py-2.5';
  }
  return 'flex items-center gap-4 rounded-xl border-2 border-dark-blue/15 bg-white/60 px-5 py-2.5 text-dark-blue/70';
}

export function Leaderboard({ entries }: LeaderboardProps) {
  return (
    <ol className="flex flex-col gap-2">
      {entries.map((entry, rank) => (
        <li key={entry.teamId} className={rowClasses(rank)}>
          <span className={`font-display w-10 text-2xl ${RANK_ACCENT_CLASSES[rank] ?? 'text-dark-blue/50'}`}>
            {rank + 1}
          </span>
          <span className={`flex-1 font-bold ${rank === 0 ? 'text-xl' : 'text-lg'}`}>{entry.teamName}</span>
          <span className="font-display text-xl">{entry.totalPoints}</span>
        </li>
      ))}
    </ol>
  );
}
