import type { LeaderboardEntry } from '@campus-pubquiz/types';

interface LeaderboardProps {
  entries: LeaderboardEntry[];
}

export function Leaderboard({ entries }: LeaderboardProps) {
  return (
    <ol>
      {entries.map((entry) => (
        <li key={entry.teamId}>
          <span>{entry.teamName}</span>
          <span>{entry.totalPoints}</span>
        </li>
      ))}
    </ol>
  );
}
