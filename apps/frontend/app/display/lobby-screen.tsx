import { QRCodeSVG } from 'qrcode.react';
import type { TeamView } from '@campus-pubquiz/types';
import { TeamRoster } from '@/app/display/team-roster';
import { CopyButton } from '@/app/components/copy-button';

const QR_SIZE_PX = 220;

interface LobbyScreenProps {
  teams: TeamView[];
  joinCode: string | null | undefined;
}

export function LobbyScreen({ teams, joinCode }: LobbyScreenProps) {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-8 px-16 text-center">
      <TeamRoster teams={teams} />
      <h1 className="font-display text-4xl">Waiting for the quiz to start…</h1>
      {joinCode && (
        <div className="flex flex-col items-center gap-4">
          <div className="rounded-2xl border-2 border-foreground/30 bg-white p-5">
            <QRCodeSVG
              value={`${window.location.origin}/play?code=${joinCode}`}
              title="Join QR code"
              size={QR_SIZE_PX}
            />
          </div>
          <p className="text-sm font-extrabold tracking-wide text-foreground/55">
            SCAN TO JOIN — OR GO TO /PLAY AND ENTER THE CODE
          </p>
          <p className="flex max-w-3xl flex-wrap items-center justify-center gap-3 text-center">
            <span className="font-display text-3xl tracking-widest text-magenta wrap-break-word">
              {joinCode}
            </span>
            <CopyButton value={joinCode} className="text-2xl text-magenta" />
          </p>
        </div>
      )}
    </div>
  );
}
