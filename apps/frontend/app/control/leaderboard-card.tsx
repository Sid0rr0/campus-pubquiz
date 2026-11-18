import {
  ordinal,
  type BlockBoard,
  type LiveRankBoard,
  type RankCalloutGroup,
} from '@campus-pubquiz/types';

/** Every place a tied group fills, read bottom-up like the reveal: "3rd - 2nd"; one team is just "3rd". */
function places({ rank, teams }: RankCalloutGroup): string {
  const worst = rank + teams.length - 1;
  return worst === rank
    ? ordinal(rank)
    : `${ordinal(worst)} - ${ordinal(rank)}`;
}

function Group({
  group,
  label,
  isCurrent,
}: {
  group: RankCalloutGroup;
  label: string;
  isCurrent: boolean;
}) {
  // Tied teams' common facts are said once, below the names, not under each team.
  const shared =
    group.teams.length > 1
      ? group.teams[0].callouts.filter((line) =>
          group.teams.every((team) => team.callouts.includes(line)),
        )
      : [];
  const lines = (callouts: string[]) => (
    <ul className={isCurrent ? 'text-base' : 'text-sm'}>
      {callouts.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
  return (
    <section
      aria-label={label}
      className={
        isCurrent ? 'flex flex-col gap-2' : 'flex flex-col gap-1 opacity-50'
      }
    >
      <p className="text-xs font-extrabold tracking-wide text-foreground/55 uppercase">
        {label} · {places(group)}
      </p>
      {group.teams.map((team) => (
        <div key={team.teamId} className="break-words">
          <p
            className={
              isCurrent ? 'font-display text-2xl' : 'font-display text-base'
            }
          >
            {team.teamName} · {team.totalPoints}{' '}
            {team.totalPoints === 1 ? 'point' : 'points'}
            {team.hasLeft && (
              <span className="ml-2 text-xs font-bold text-foreground/55">
                left
              </span>
            )}
          </p>
          {lines(team.callouts.filter((line) => !shared.includes(line)))}
        </div>
      ))}
      {shared.length > 0 && lines(shared)}
    </section>
  );
}

/** A block's whole board, bottom-up, as the 🏆 marker previews it. */
export function BlockBoardCard({ board }: { board: BlockBoard }) {
  return (
    <section aria-label="Block board card" className="flex flex-col gap-4">
      {board.isGradingUnfinished && (
        <p className="text-xs font-extrabold text-magenta uppercase">
          Grading not finished
        </p>
      )}
      {board.groups.map((group) => (
        <Group key={group.rank} group={group} label="Board" isCurrent />
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
