'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
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
    handleJoin,
  } = useTeamJoin(codeFromUrl);
  const [showTeamCode, setShowTeamCode] = useState(false);

  // Mirrors /play's join gate: teamName (local state, cleared by "log out")
  // is the source of truth, not team (socket state, which the mocked/real
  // hook never explicitly resets once a join has been accepted).
  const isForm = !teamName || Boolean(connectionError && !team);
  const isJoined = !isForm && Boolean(team);
  const isConnecting = !isForm && !team;

  useEffect(() => {
    // A successful join has nothing left to do on the home page — hand off
    // straight to /play, which already reads the identity this just stored.
    if (isJoined) {
      router.push('/play');
    }
  }, [isJoined, router]);

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

            {connectionError && (
              <p role="alert" className="mb-3 text-sm font-extrabold text-magenta">
                {connectionError}
              </p>
            )}

            <form onSubmit={onSubmit} className="flex flex-col gap-2">
              <label htmlFor="home-team-name" className="text-xs font-extrabold tracking-wide text-foreground/55">
                Team name
              </label>
              <input
                id="home-team-name"
                value={nameInput}
                onChange={(event) => setNameInput(event.target.value)}
                placeholder="The Answer Key"
                className="min-h-14 rounded-2xl border-2 border-foreground/35 bg-white px-4 text-lg font-bold"
              />

              <label htmlFor="home-game-code" className="mt-2 text-xs font-extrabold tracking-wide text-foreground/55">
                Game code
              </label>
              <input
                id="home-game-code"
                value={codeInput}
                onChange={(event) => setCodeInput(event.target.value)}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                placeholder="e.g. BOLD-AMBER-OTTER"
                className="min-h-14 rounded-2xl border-2 border-foreground/35 bg-white px-4 text-lg font-bold uppercase tracking-widest"
              />

              {showTeamCode ? (
                <>
                  <label htmlFor="home-team-code" className="mt-2 text-xs font-extrabold tracking-wide text-foreground/55">
                    Team code
                  </label>
                  <input
                    id="home-team-code"
                    value={teamCodeInput}
                    onChange={(event) => setTeamCodeInput(event.target.value)}
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="e.g. QUICK-JADE-FOX"
                    className="min-h-14 rounded-2xl border-2 border-foreground/35 bg-white px-4 text-lg font-bold uppercase tracking-widest"
                  />
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowTeamCode(true)}
                  className="mt-2 self-start text-[13px] font-extrabold text-foreground/55 underline"
                >
                  Played before? Enter your team code
                </button>
              )}

              <button
                type="submit"
                className="mt-4 min-h-14 rounded-2xl bg-magenta font-display text-lg text-white shadow-[0_4px_0_#b8006d]"
              >
                Join the quiz
              </button>
            </form>
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
