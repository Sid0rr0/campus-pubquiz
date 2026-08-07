'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type FormEvent } from 'react';
import { JoinForm } from '@/app/components/join-form';
import { useTeamJoin } from '@/app/lib/use-team-join';

interface JoinPanelProps {
  codeFromUrl: string;
}

export function JoinPanel({ codeFromUrl }: JoinPanelProps) {
  const router = useRouter();
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
    snapshot,
    handleJoin,
  } = useTeamJoin(codeFromUrl);

  // Mirrors /play's join gate: teamName (local state, cleared by "log out")
  // is the source of truth, not team (socket state, which the mocked/real
  // hook never explicitly resets once a join has been accepted).
  const isForm = !teamName || Boolean(connectionError && !team);
  const isJoined = !isForm && Boolean(team);
  const isConnecting = !isForm && !team;

  useEffect(() => {
    // A successful join has nothing left to do on the home page — hand off
    // straight to /play, which already reads the identity this just stored.
    // Carries ?code= along so the URL identifies this game from the first
    // paint instead of relying on /play's own localStorage-restore sync.
    if (isJoined && snapshot) {
      router.push(`/play?code=${snapshot.joinCode}`);
    }
  }, [isJoined, snapshot, router]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    handleJoin(event);
  }

  return (
    <section className="flex flex-1 justify-center px-5 pb-14 pt-9">
      <div className="w-full max-w-md rounded-3xl border-2 border-foreground/10 bg-white p-7 shadow-[0_16px_36px_rgba(46,49,146,0.1)]">
        {isForm && (
          <>
            <h2 className="mb-1 font-display text-2xl">Join the quiz</h2>
            <p className="mb-5 text-sm font-semibold text-foreground/55">Takes about ten seconds.</p>
            <JoinForm
              nameInput={nameInput}
              onNameInputChange={setNameInput}
              codeInput={codeInput}
              onCodeInputChange={setCodeInput}
              teamCodeInput={teamCodeInput}
              onTeamCodeInputChange={setTeamCodeInput}
              connectionError={connectionError}
              onSubmit={onSubmit}
            />
          </>
        )}

        {isConnecting && (
          <div className="flex flex-col items-center gap-3.5 py-8">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-foreground/15 border-t-magenta" />
            <p className="text-[15px] font-extrabold">Connecting to the table…</p>
          </div>
        )}

        {isJoined && (
          <div className="flex flex-col items-center gap-3.5 py-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green text-lg text-white">
              ✓
            </div>
            <p className="text-[15px] font-extrabold">You&apos;re in, {teamName}! Heading to the game…</p>
          </div>
        )}
      </div>
    </section>
  );
}
