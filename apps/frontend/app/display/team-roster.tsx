import type { TeamView } from '@campus-pubquiz/types';

const TEAM_CHIP_TEXT_CLASSES = [
  'text-cyan',
  'text-magenta',
  'text-green',
  'text-orange',
];

interface TeamRosterProps {
  teams: TeamView[];
}

export function TeamRoster({ teams }: TeamRosterProps) {
  return (
    <div
      aria-label="Connected teams"
      className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 px-16 pb-10"
    >
      <p className="text-sm font-extrabold tracking-wide text-foreground/55">
        {teams.length} {teams.length === 1 ? 'TEAM' : 'TEAMS'} JOINED
      </p>
      <div className="flex max-w-5xl flex-wrap items-center justify-center gap-x-6 gap-y-2">
        {teams.map((team, index) => (
          <span
            key={team.teamId}
            className={`font-display text-2xl ${TEAM_CHIP_TEXT_CLASSES[index % TEAM_CHIP_TEXT_CLASSES.length]}`}
          >
            {team.teamName}
          </span>
        ))}
      </div>
    </div>
  );
}
