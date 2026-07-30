'use client';

import type { TeamView } from '@campus-pubquiz/types';

interface TeamsPanelProps {
  teams: TeamView[];
  showAnswerStatus: boolean;
  answeredTeamIds: number[];
  onKickTeam: (teamId: number) => void;
  className?: string;
}

export function TeamsPanel({
  teams,
  showAnswerStatus,
  answeredTeamIds,
  onKickTeam,
  className = '',
}: TeamsPanelProps) {
  if (teams.length === 0) {
    return null;
  }

  return (
    <section className={`flex flex-col gap-2 ${className}`}>
      <h2 className="text-xs font-extrabold tracking-wide text-background/60">
        Teams ({teams.length})
      </h2>
      <ul className="flex flex-col gap-1">
        {teams.map((team) => {
          const hasAnswered = showAnswerStatus && answeredTeamIds.includes(team.teamId);
          return (
            <li
              key={team.teamId}
              aria-label={
                showAnswerStatus
                  ? `${team.teamName} ${hasAnswered ? 'has answered' : 'has not answered yet'}`
                  : undefined
              }
              className="flex items-center gap-1.5 text-sm font-bold"
            >
              <span aria-hidden="true" className={team.isConnected ? 'text-green' : 'text-background/30'}>
                ●
              </span>
              {team.teamName}
              {hasAnswered && (
                <span aria-hidden="true" className="ml-1 text-cyan">
                  ✓
                </span>
              )}
              {team.isConnected && (
                <button
                  type="button"
                  onClick={() => onKickTeam(team.teamId)}
                  className="ml-auto text-xs font-extrabold text-magenta underline"
                >
                  Kick
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
