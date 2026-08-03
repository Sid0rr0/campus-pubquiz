import type { TeamView } from '@campus-pubquiz/types';

const SCATTER_TEXT_CLASSES = ['text-cyan', 'text-magenta', 'text-green', 'text-orange'];
// Keep scattered names inside the visible lobby area (percent of container).
const SCATTER_LEFT_RANGE = { min: 4, span: 70 };
const SCATTER_TOP_RANGE = { min: 8, span: 76 };
const SCATTER_TILT_MAX_DEG = 8;

// Deterministic pseudo-random in [0, 1) so each team keeps its spot across
// re-renders and reconnects instead of jumping around the screen.
function hashToUnit(seed: string, salt: number): number {
  let hash = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

interface ScatteredTeamNamesProps {
  teams: TeamView[];
}

export function ScatteredTeamNames({ teams }: ScatteredTeamNamesProps) {
  return (
    <div aria-label="Connected teams" className="pointer-events-none absolute inset-0">
      {teams.map((team, index) => (
        <span
          key={team.teamId}
          style={{
            left: `${SCATTER_LEFT_RANGE.min + hashToUnit(String(team.teamId), 1) * SCATTER_LEFT_RANGE.span}%`,
            top: `${SCATTER_TOP_RANGE.min + hashToUnit(String(team.teamId), 2) * SCATTER_TOP_RANGE.span}%`,
            transform: `rotate(${(hashToUnit(String(team.teamId), 3) * 2 - 1) * SCATTER_TILT_MAX_DEG}deg)`,
          }}
          className={`absolute font-display text-2xl ${SCATTER_TEXT_CLASSES[index % SCATTER_TEXT_CLASSES.length]}`}
        >
          {team.teamName}
        </span>
      ))}
    </div>
  );
}
