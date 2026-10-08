import { JoinDetails } from '@/app/display/join-details';

interface JoinOverlayScreenProps {
  joinCode: string | null | undefined;
  maxPlayersPerTeam: number;
  extraPlayerPenaltyPoints: number;
}

/** Covers the big screen mid-quiz so a late team can scan in; no roster. */
export function JoinOverlayScreen({
  joinCode,
  maxPlayersPerTeam,
  extraPlayerPenaltyPoints,
}: JoinOverlayScreenProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-16 text-center">
      <h1 className="font-display text-display-xl">Join the quiz</h1>
      {joinCode && (
        <JoinDetails
          joinCode={joinCode}
          maxPlayersPerTeam={maxPlayersPerTeam}
          extraPlayerPenaltyPoints={extraPlayerPenaltyPoints}
        />
      )}
    </div>
  );
}
