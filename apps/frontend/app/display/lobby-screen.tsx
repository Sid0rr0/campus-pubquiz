import { QRCodeSVG } from 'qrcode.react';
import type { TeamView } from '@campus-pubquiz/types';
import { TeamRoster } from '@/app/display/team-roster';

const QR_SIZE_PX = 320;

interface LobbyScreenProps {
  teams: TeamView[];
  joinCode: string | null | undefined;
  maxPlayersPerTeam: number;
  extraPlayerPenaltyPoints: number;
}

export function LobbyScreen({
  teams,
  joinCode,
  maxPlayersPerTeam,
  extraPlayerPenaltyPoints,
}: LobbyScreenProps) {
  return (
    <div className="flex flex-1 flex-col px-16 text-center">
      <div className="flex flex-1 flex-col items-center gap-8">
        <h1 className="font-display text-display-xl">
          Waiting for the teams to join…
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
            <p className="text-display-sm font-extrabold tracking-wide text-foreground/55 flex gap-2 items-center">
              <span>
                SCAN TO JOIN — OR GO TO /PLAY AND FIND A GAME WITH THE CODE
              </span>
              <span className="font-display text-display-xl tracking-widest text-magenta wrap-break-word">
                {joinCode}
              </span>
            </p>

            <p className="text-display-2xl font-semibold">
              Make teams of up to {maxPlayersPerTeam} players, only one device
              connects per team. Every additional player costs the team −
              {extraPlayerPenaltyPoints} points.
            </p>
          </div>
        )}
      </div>
      <TeamRoster teams={teams} />
    </div>
  );
}
