import { versusSideColor } from '@campus-pubquiz/types';
import type { ScreenViewProps } from '@/app/components/display-screen-view';
import { JoinDetails } from '@/app/display/join-details';
import { LeagueTopCard } from '@/app/display/league-top';
import { TeamRoster } from '@/app/display/team-roster';

export function LobbyScreen({
  screen,
  settings,
  live,
}: ScreenViewProps<'lobby'>) {
  if (!live) return null;
  const { teams, leagueTop, isConnected, joinCode, onPickAnotherGame } = live;
  const { maxPlayersPerTeam, extraPlayerPenaltyPoints } = settings;
  return (
    <div className="flex flex-1 flex-col px-16 text-center">
      <div className="flex flex-1 flex-col items-center gap-8">
        <h1 className="font-display text-display-xl">
          Waiting for the teams to join…
        </h1>
        <div className="flex items-start justify-center gap-12">
          {joinCode && (
            <JoinDetails
              joinCode={joinCode}
              maxPlayersPerTeam={maxPlayersPerTeam}
              extraPlayerPenaltyPoints={extraPlayerPenaltyPoints}
            />
          )}
          {leagueTop && <LeagueTopCard leagueTop={leagueTop} />}
        </div>
        {screen.sideCounts && (
          <ul
            data-testid="side-counts"
            className="flex justify-center gap-8 text-display-xl"
          >
            {screen.sideCounts.map((side) => (
              <li key={side.id} className="flex items-center gap-3">
                <span
                  className="size-6 rounded-full"
                  style={{ backgroundColor: versusSideColor(side.colorIndex) }}
                />
                {side.name}: {side.teamCount}{' '}
                {side.teamCount === 1 ? 'team' : 'teams'}
              </li>
            ))}
          </ul>
        )}
      </div>
      <TeamRoster teams={teams} isConnected={isConnected} />
      <button
        type="button"
        onClick={onPickAnotherGame}
        className="mx-auto my-2 text-sm text-muted-foreground underline"
      >
        Pick another game
      </button>
    </div>
  );
}
