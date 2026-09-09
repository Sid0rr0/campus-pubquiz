import { QRCodeSVG } from 'qrcode.react';
import type { TeamView } from '@campus-pubquiz/types';
import { TeamRoster } from '@/app/display/team-roster';

const QR_SIZE_PX = 320;

interface LobbyScreenProps {
  teams: TeamView[];
  joinCode: string | null | undefined;
  maxPlayersPerTeam: number;
}

export function LobbyScreen({
  teams,
  joinCode,
  maxPlayersPerTeam,
}: LobbyScreenProps) {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-8 px-16 text-center">
      <TeamRoster teams={teams} />
      <h1 className="font-display text-[calc(2.25rem*var(--display-text-scale,1))]">
        Waiting for the quiz to start…
      </h1>
      {joinCode && (
        <div className="flex flex-col items-center gap-4">
          <div className="rounded-2xl border-2 border-foreground/30 bg-white p-5">
            <QRCodeSVG
              value={`${window.location.origin}/play?code=${joinCode}`}
              title="Join QR code"
              size={QR_SIZE_PX}
            />
          </div>
          <p className="text-[calc(0.875rem*var(--display-text-scale,1))] font-extrabold tracking-wide text-foreground/55">
            SCAN TO JOIN — OR GO TO /PLAY AND FIND A GAME WITH THE CODE
          </p>
          <p className="flex max-w-3xl flex-wrap items-center justify-center gap-3 text-center">
            <span className="font-display text-[calc(1.25rem*var(--display-text-scale,1))] tracking-widest text-magenta wrap-break-word">
              {joinCode}
            </span>
          </p>
          <p className="text-[calc(1.5rem*var(--display-text-scale,1))] font-semibold">
            Make teams of up to {maxPlayersPerTeam} players, only one device
            connects per team.
          </p>
        </div>
      )}
    </div>
  );
}
