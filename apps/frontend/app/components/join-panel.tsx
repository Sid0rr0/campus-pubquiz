'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { CheckIcon } from '@radix-ui/react-icons';
import { JoinTicket } from '@/app/components/join-form';
import { useTeamLink } from '@/app/lib/use-team-link';

interface JoinPanelProps {
  codeFromUrl: string;
}

export function JoinPanel({ codeFromUrl }: JoinPanelProps) {
  const router = useRouter();
  const { join, game } = useTeamLink(codeFromUrl);
  const { teamName, team, needsJoinForm } = join;

  const isJoined = !needsJoinForm && Boolean(team);
  const joinCode = game?.view.joinCode;
  const isConnecting = !needsJoinForm && !team;

  useEffect(() => {
    // A successful join has nothing left to do on the home page — hand off
    // straight to /play, which already reads the identity this just stored.
    // Carries ?code= along so the URL identifies this game from the first
    // paint instead of relying on /play's own localStorage-restore sync.
    if (isJoined && joinCode) {
      router.push(`/play?code=${joinCode}`);
    }
  }, [isJoined, joinCode, router]);

  return (
    <section className="-mt-14 flex justify-center px-4 pb-10 sm:-mt-20">
      <JoinTicket join={join}>
        {isConnecting && (
          <div className="flex flex-col items-center gap-3.5 py-8">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-foreground/15 border-t-magenta" />
            <p className="text-[15px] font-extrabold">
              Connecting to the table…
            </p>
          </div>
        )}

        {isJoined && (
          <div className="flex flex-col items-center gap-3.5 py-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green text-white">
              <CheckIcon aria-hidden="true" className="h-6 w-6" />
            </div>
            <p className="text-[15px] font-extrabold">
              You&apos;re in, {teamName}! Heading to the game…
            </p>
          </div>
        )}
      </JoinTicket>
    </section>
  );
}
