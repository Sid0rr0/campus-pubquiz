import type { LiveRankBoard, RankCalloutGroup } from '@campus-pubquiz/types';
import { ordinal } from '@/app/lib/placing-text';

function Group({
  group,
  label,
  isCurrent,
}: {
  group: RankCalloutGroup;
  label: string;
  isCurrent: boolean;
}) {
  return (
    <section
      aria-label={label}
      className={
        isCurrent ? 'flex flex-col gap-2' : 'flex flex-col gap-1 opacity-50'
      }
    >
      <p className="text-xs font-extrabold tracking-wide text-foreground/55 uppercase">
        {label} · {ordinal(group.rank)}
      </p>
      {group.teams.map((team) => (
        <div key={team.teamId} className="break-words">
          <p
            className={
              isCurrent ? 'font-display text-2xl' : 'font-display text-base'
            }
          >
            {team.teamName} · {team.totalPoints}
          </p>
          <ul className={isCurrent ? 'text-base' : 'text-sm'}>
            {team.callouts.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

/** The quiz master's card while the leaderboard is up: the rank group just revealed, large, and the next one, dimmed. */
export function LeaderboardCard({ board }: { board: LiveRankBoard }) {
  return (
    <section aria-label="Leaderboard card" className="flex flex-col gap-4">
      {board.all?.map((group) => (
        <Group key={group.rank} group={group} label="Board" isCurrent />
      ))}
      {board.current && (
        <Group group={board.current} label="Revealed" isCurrent />
      )}
      {board.next && (
        <Group group={board.next} label="Next" isCurrent={false} />
      )}
    </section>
  );
}
