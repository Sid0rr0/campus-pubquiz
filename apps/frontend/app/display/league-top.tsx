import type { LeagueTop } from '@campus-pubquiz/types';

interface LeagueTopCardProps {
  leagueTop: LeagueTop;
}

/** The lobby's league: its name and the top rows of its table, drawn beside the join details. */
export function LeagueTopCard({ leagueTop }: LeagueTopCardProps) {
  return (
    <section
      aria-label={leagueTop.name}
      className="flex w-[34rem] shrink-0 flex-col gap-4 rounded-2xl border-2 border-foreground/30 p-6 text-left"
    >
      <h2 className="font-display text-display-xl text-orange">
        {leagueTop.name}
      </h2>
      {leagueTop.rows.length === 0 ? (
        <p className="text-display-md text-foreground/55">No points yet.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {leagueTop.rows.map((row) => (
            <li
              key={row.teamId}
              className="flex items-baseline gap-4 text-display-lg"
            >
              <span className="w-10 font-display text-display-xl text-cyan">
                {row.position}
              </span>
              <span className="flex-1 truncate font-semibold">
                {row.teamName}
              </span>
              <span className="font-extrabold whitespace-nowrap">
                {row.leaguePoints} pts
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
