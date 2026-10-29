'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type SubmitEvent } from 'react';
import { CheckIcon } from '@radix-ui/react-icons';
import { JoinForm, TeamCodeField } from '@/app/components/join-form';
import { useTeamLink } from '@/app/lib/use-team-link';

interface JoinPanelProps {
  codeFromUrl: string;
}

export function JoinPanel({ codeFromUrl }: JoinPanelProps) {
  const router = useRouter();
  const { join, game } = useTeamLink(codeFromUrl);
  const {
    teamName,
    nameInput,
    setNameInput,
    codeInput,
    setCodeInput,
    teamCodeInput,
    setTeamCodeInput,
    connectionError,
    team,
    needsJoinForm,
    handleJoin,
  } = join;

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

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    handleJoin(event);
  }

  return (
    <section className="-mt-14 flex justify-center px-4 pb-10 sm:-mt-20">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-foreground/15 bg-white shadow-[0_16px_36px_rgba(46,49,146,0.1)]">
        <div className="bg-magenta px-6 py-4 text-white sm:py-5">
          <h2 className="font-display text-3xl leading-tight sm:text-4xl">
            Join live game
          </h2>
        </div>

        <div className="px-6 pb-6 pt-4 sm:pt-5">
          {needsJoinForm && (
            <JoinForm
              nameInput={nameInput}
              onNameInputChange={setNameInput}
              codeInput={codeInput}
              onCodeInputChange={setCodeInput}
              teamCodeInput={teamCodeInput}
              onTeamCodeInputChange={setTeamCodeInput}
              connectionError={connectionError}
              onSubmit={onSubmit}
              omitTeamCode
            />
          )}

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
        </div>

        {needsJoinForm && (
          // The stub: a returning team's code, torn off below the Join button.
          <div className="relative flex flex-col gap-2 border-t-2 border-dashed border-foreground/25 px-6 pb-3 pt-2">
            <span
              aria-hidden="true"
              className="absolute -left-3 -top-3 h-6 w-6 rounded-full border border-foreground/25 bg-background"
            />
            <span
              aria-hidden="true"
              className="absolute -right-3 -top-3 h-6 w-6 rounded-full border border-foreground/25 bg-background"
            />
            <TeamCodeField
              value={teamCodeInput}
              onChange={setTeamCodeInput}
              connectionError={connectionError}
              onStub
            />
          </div>
        )}
      </div>
    </section>
  );
}
