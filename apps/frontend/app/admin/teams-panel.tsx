'use client';

import { Cross2Icon } from '@radix-ui/react-icons';
import type { TeamView } from '@campus-pubquiz/types';
import { Button } from '@/app/components/button';
import { ConfirmDialog } from '@/app/components/confirm-dialog';

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
    return (
      <section className={`flex flex-col gap-2 ${className}`}>
        <h2 className="text-xs font-extrabold tracking-wide text-background/60">
          Teams (0)
        </h2>
        <p className="text-sm font-bold text-background/50">
          No teams have joined yet.
        </p>
      </section>
    );
  }

  return (
    <section className={`flex flex-col gap-2 ${className}`}>
      <h2 className="text-xs font-extrabold tracking-wide text-background/60">
        Teams ({teams.length})
      </h2>
      <ul className="flex flex-col gap-1.5">
        {teams.map((team) => {
          const hasAnswered =
            showAnswerStatus && answeredTeamIds.includes(team.teamId);
          return (
            <li
              key={team.teamId}
              aria-label={
                showAnswerStatus
                  ? `${team.teamName} ${hasAnswered ? 'has answered' : 'has not answered yet'}`
                  : undefined
              }
            >
              <div className="flex items-center gap-1.5 text-sm font-bold">
                <span
                  aria-hidden="true"
                  className={
                    team.isConnected ? 'text-green' : 'text-background/30'
                  }
                >
                  ●
                </span>
                <span className="sr-only">
                  {team.isConnected ? 'Connected' : 'Disconnected'}
                </span>
                {team.teamName}
                {hasAnswered && (
                  <span aria-hidden="true" className="ml-1 text-cyan">
                    ✓
                  </span>
                )}
                <ConfirmDialog
                  trigger={
                    <Button
                      type="button"
                      className="ml-auto flex items-center gap-1 text-xs font-extrabold text-magenta underline"
                    >
                      <Cross2Icon aria-hidden="true" />
                      Kick
                    </Button>
                  }
                  title={`Kick ${team.teamName}?`}
                  description="They'll be removed from the session and can rejoin with the join code."
                  confirmLabel="Kick"
                  onConfirm={() => onKickTeam(team.teamId)}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
