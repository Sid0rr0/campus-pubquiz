import type { LeagueTop, TeamView } from '@campus-pubquiz/types';
import { JoinDetails } from '@/app/display/join-details';
import { LeagueTopCard } from '@/app/display/league-top';
import { TeamRoster } from '@/app/display/team-roster';

interface LobbyScreenProps {
  teams: TeamView[];
  leagueTop: LeagueTop | null;
  isConnected: boolean;
  joinCode: string | null | undefined;
  maxPlayersPerTeam: number;
  extraPlayerPenaltyPoints: number;
  onPickAnotherGame: () => void;
}

export function LobbyScreen({
  teams,
  leagueTop,
  isConnected,
  joinCode,
  maxPlayersPerTeam,
  extraPlayerPenaltyPoints,
  onPickAnotherGame,
}: LobbyScreenProps) {
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
