'use client';

import { Cross2Icon } from '@radix-ui/react-icons';
import type {
  AdminTeamView,
  JokerPickRound,
  JokerSource,
} from '@campus-pubquiz/types';
import { Button } from '@/app/components/button';
import { ConfirmDialog } from '@/app/components/confirm-dialog';
import { PlayerCountEditor } from '@/app/control/player-count-editor';

/** How a team came to hold its joker, as the quiz master reads it. */
const JOKER_SOURCE_LABELS: Record<JokerSource, string> = {
  chosen: 'picked',
  drawn: 'drawn',
  set_by_quiz_master: 'set by you',
};

interface TeamsPanelProps {
  teams: AdminTeamView[];
  showAnswerStatus: boolean;
  answeredTeamIds: number[];
  onKickTeam: (teamId: number) => void;
  onSetPlayerCount: (teamId: number, playerCount: number) => void;
  /** The rounds a team's joker may be moved to (none: the list is left out). */
  jokerRounds: JokerPickRound[];
  onSetJoker: (teamId: number, roundId: number) => void;
  className?: string;
}

function roundOptionLabel(roundNumber: number, title: string): string {
  return `Round ${roundNumber} — ${title}`;
}

/** The quiz master's list for moving one team's joker to a round that has not started. */
function JokerRoundSelect({
  team,
  jokerRounds,
  onSetJoker,
}: {
  team: AdminTeamView;
  jokerRounds: JokerPickRound[];
  onSetJoker: (teamId: number, roundId: number) => void;
}) {
  const current = team.joker;
  const isCurrentListed = jokerRounds.some(
    (round) => round.roundId === current?.roundId,
  );
  return (
    <label className="ml-5 flex items-center gap-1.5 text-xs font-bold text-background/70">
      <span className="sr-only">Joker round for {team.teamName}</span>
      <select
        value={current ? String(current.roundId) : ''}
        onChange={(event) =>
          onSetJoker(team.teamId, Number(event.target.value))
        }
        className="max-w-full rounded border border-background/30 bg-foreground px-1 py-0.5 text-xs text-background"
      >
        {!current && (
          <option value="" disabled>
            No joker yet
          </option>
        )}
        {current && !isCurrentListed && (
          <option value={current.roundId} disabled>
            {roundOptionLabel(current.roundNumber, current.roundTitle)}{' '}
            (started)
          </option>
        )}
        {jokerRounds.map((round) => (
          <option key={round.roundId} value={round.roundId}>
            {roundOptionLabel(round.roundNumber, round.title)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TeamsPanel({
  teams,
  showAnswerStatus,
  answeredTeamIds,
  onKickTeam,
  onSetPlayerCount,
  jokerRounds,
  onSetJoker,
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
              {team.joker && (
                <p className="ml-5 text-xs font-bold text-background/70">
                  🃏 Round {team.joker.roundNumber} — {team.joker.roundTitle}{' '}
                  <span className="font-normal text-background/50">
                    ({JOKER_SOURCE_LABELS[team.joker.source]})
                  </span>
                </p>
              )}
              {jokerRounds.length > 0 && (
                <JokerRoundSelect
                  team={team}
                  jokerRounds={jokerRounds}
                  onSetJoker={onSetJoker}
                />
              )}
              <PlayerCountEditor
                team={team}
                onSetPlayerCount={onSetPlayerCount}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
