import type { ScreenViewProps } from '@/app/components/display-screen-view';
import { JoinDetails } from '@/app/display/join-details';

/** Covers the big screen mid-quiz so a late team can scan in; no roster. */
export function JoinOverlayScreen({
  settings,
  live,
}: ScreenViewProps<'join_overlay'>) {
  if (!live) return null;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-16 text-center">
      {live.joinCode && (
        <JoinDetails
          joinCode={live.joinCode}
          maxPlayersPerTeam={settings.maxPlayersPerTeam}
          extraPlayerPenaltyPoints={settings.extraPlayerPenaltyPoints}
        />
      )}
    </div>
  );
}
