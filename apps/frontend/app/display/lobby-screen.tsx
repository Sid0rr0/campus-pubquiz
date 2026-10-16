import type { TeamView } from '@campus-pubquiz/types';
import { JoinDetails } from '@/app/display/join-details';
import { TeamRoster } from '@/app/display/team-roster';

interface LobbyScreenProps {
  teams: TeamView[];
  isConnected: boolean;
  joinCode: string | null | undefined;
  maxPlayersPerTeam: number;
  extraPlayerPenaltyPoints: number;
  onPickAnotherGame: () => void;
}

export function LobbyScreen({
  teams,
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
        {joinCode && (
          <JoinDetails
            joinCode={joinCode}
            maxPlayersPerTeam={maxPlayersPerTeam}
            extraPlayerPenaltyPoints={extraPlayerPenaltyPoints}
          />
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
