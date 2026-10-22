'use client';

import type { JokerPickRound, TeamView } from '@campus-pubquiz/types';
import { formatSecondsLeft, useSecondsLeft } from '@/app/lib/use-seconds-left';

interface JokerPickScreenProps {
  /** Epoch-ms deadline the pick closes at, or null once it has closed. */
  endsAt: number | null;
  /** Every round of the quiz. */
  rounds: JokerPickRound[];
  /** Every team on the roster; empty without a running session. */
  teams: readonly Pick<TeamView, 'teamId' | 'teamName'>[];
  /** Ids of the teams that have picked. */
  pickedTeamIds: readonly number[];
}

/**
 * The big screen while teams pick their joker round: every round listed like
 * the overview, the server's countdown, and the teams that have picked ticked
 * off with "N/M picked". It never shows which round any team picked.
 */
export function JokerPickScreen({
  endsAt,
  rounds,
  teams,
  pickedTeamIds,
}: JokerPickScreenProps) {
  const secondsLeft = useSecondsLeft(endsAt);
  const pickedTeams = teams.filter(({ teamId }) =>
    pickedTeamIds.includes(teamId),
  );
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-16 text-center">
      <h1 className="font-display text-display-3xl">
        <span className="text-magenta">Pick your joker</span>
      </h1>
      <p className="text-display-xl font-bold text-foreground/70">
        Choose a round on your phone: its points count double.
      </p>
      {secondsLeft !== null && (
        <p
          role="timer"
          aria-label="Time left to pick a joker"
          className="font-display text-display-4xl text-cyan"
        >
          {formatSecondsLeft(secondsLeft)}
        </p>
      )}
      <p className="text-display-xl font-bold text-foreground/70">
        {pickedTeams.length}/{teams.length} picked
      </p>
      {pickedTeams.length > 0 && (
        <ul
          aria-label="Teams that picked"
          className="flex max-w-[calc(60rem*var(--display-text-scale,1))] flex-wrap justify-center gap-x-6 gap-y-2 text-display-xl font-bold text-green"
        >
          {pickedTeams.map((team) => (
            <li key={team.teamId}>
              <span aria-hidden="true">✓ </span>
              {team.teamName}
            </li>
          ))}
        </ul>
      )}
      <ol className="mx-auto flex max-w-[calc(36rem*var(--display-text-scale,1))] flex-col gap-3 text-left">
        {rounds.map((round) => (
          <li
            key={round.roundId}
            className="flex items-start gap-3 text-display-2xl font-bold"
          >
            <span aria-hidden="true" className="text-cyan">
              {round.roundNumber}.
            </span>
            <span>
              <span>{round.title}</span>
              {round.category && (
                <span className="ml-2 text-cyan">{round.category}</span>
              )}
              {round.author && (
                <span className="block text-display-base font-bold text-foreground/60">
                  by {round.author}
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
