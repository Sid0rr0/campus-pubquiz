'use client';

import { useState, type SubmitEvent } from 'react';
import { EnterIcon } from '@radix-ui/react-icons';
import { Button } from '@/app/components/button';
import { LiveSessionSelect } from '@/app/components/live-session-select';

interface JoinFormProps {
  nameInput: string;
  onNameInputChange: (value: string) => void;
  codeInput: string;
  onCodeInputChange: (value: string) => void;
  teamCodeInput: string;
  onTeamCodeInputChange: (value: string) => void;
  connectionError: string | null;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  /** /play shows the team code field from the start — it's the reconnect/direct-visit fallback, where "played before?" is the common case rather than the exception the home page's collapsed toggle assumes. */
  alwaysShowTeamCode?: boolean;
  /** /play hides the manual game code field — a team landing there already has a code (QR scan) or picks a running game from the select above it, so the raw input is just clutter. */
  hideGameCodeInput?: boolean;
}

/**
 * The team-join form fields shared by the home page and /play (a returning
 * team's reconnect fallback, or anyone landing on /play directly) — the two
 * pages differ only in the chrome around this (heading/subtitle, a
 * connecting/joined state on the home page, a "log out" link on /play), not
 * in how a team actually gets in.
 */
export function JoinForm({
  nameInput,
  onNameInputChange,
  codeInput,
  onCodeInputChange,
  teamCodeInput,
  onTeamCodeInputChange,
  connectionError,
  onSubmit,
  alwaysShowTeamCode = false,
  hideGameCodeInput = false,
}: JoinFormProps) {
  const [teamCodeRevealed, setTeamCodeRevealed] = useState(false);
  // A stored team code (returning team) or a connection error asking for one
  // (name collision) both mean the field should just be there already —
  // only a fresh join with nothing to say yet starts it collapsed.
  const showTeamCode =
    alwaysShowTeamCode ||
    teamCodeRevealed ||
    Boolean(teamCodeInput) ||
    Boolean(connectionError);

  return (
    <>
      {connectionError && (
        <p
          role="alert"
          className="mb-3 text-center text-sm font-extrabold text-magenta"
        >
          {connectionError}
        </p>
      )}
      <form onSubmit={onSubmit} className="flex flex-col gap-2">
        <label
          htmlFor="join-team-name"
          className="text-xs font-extrabold tracking-wide text-foreground/55"
        >
          Team name
        </label>
        <input
          id="join-team-name"
          value={nameInput}
          onChange={(event) => onNameInputChange(event.target.value)}
          autoComplete="off"
          placeholder="The Answer Key"
          className="min-h-14 rounded-2xl border-2 border-foreground/35 bg-white px-4 text-lg font-bold"
        />
        <LiveSessionSelect
          value={codeInput}
          onSelectSession={onCodeInputChange}
        />
        {!hideGameCodeInput && (
          <>
            <label
              htmlFor="join-game-code"
              className="mt-2 text-xs font-extrabold tracking-wide text-foreground/55"
            >
              Game code
            </label>
            <input
              id="join-game-code"
              value={codeInput}
              onChange={(event) => onCodeInputChange(event.target.value)}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              placeholder="e.g. BOLD-AMBER-OTTER"
              className="min-h-14 rounded-2xl border-2 border-foreground/35 bg-white px-4 text-lg font-bold uppercase tracking-widest"
            />
          </>
        )}
        {showTeamCode ? (
          <>
            <label
              htmlFor="join-team-code"
              className="mt-2 text-xs font-extrabold tracking-wide text-foreground/55"
            >
              Team code (for returning teams)
            </label>
            <input
              id="join-team-code"
              value={teamCodeInput}
              onChange={(event) => onTeamCodeInputChange(event.target.value)}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              placeholder="e.g. QUICK-JADE-FOX"
              className="min-h-14 rounded-2xl border-2 border-foreground/35 bg-white px-4 text-lg font-bold uppercase tracking-widest"
            />
          </>
        ) : (
          <Button
            type="button"
            onClick={() => setTeamCodeRevealed(true)}
            className="mt-2 self-start text-[13px] font-extrabold text-foreground/55 underline"
          >
            Played before? Enter your team code
          </Button>
        )}
        <Button
          type="submit"
          variant="solid"
          className="mt-4 flex min-h-14 items-center justify-center gap-2 rounded-2xl text-lg"
        >
          <EnterIcon aria-hidden="true" />
          Join the quiz
        </Button>
      </form>
    </>
  );
}
