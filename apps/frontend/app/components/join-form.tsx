'use client';

import { useState, type SubmitEvent } from 'react';
import { ChevronRightIcon, EnterIcon } from '@radix-ui/react-icons';
import { useQuery } from '@tanstack/react-query';
import { fetchPublicSessions } from '@/app/lib/sessions-api';
import { queryKeys } from '@/app/lib/query-keys';
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
  /** The home page renders `TeamCodeField` itself, on the ticket's stub below the Join button. */
  omitTeamCode?: boolean;
}

/** The form's id, for a `TeamCodeField` rendered outside it so Enter there still submits the join. */
export const JOIN_FORM_ID = 'join-form';

interface TeamCodeFieldProps {
  value: string;
  onChange: (value: string) => void;
  connectionError: string | null;
  alwaysShow?: boolean;
  /** Collapsed, reads as the home page ticket's tear-off stub instead of a quiet link. */
  onStub?: boolean;
}

/** The returning team's code: collapsed behind a "Played before?" toggle on a fresh join. */
export function TeamCodeField({
  value,
  onChange,
  connectionError,
  alwaysShow = false,
  onStub = false,
}: TeamCodeFieldProps) {
  const [revealed, setRevealed] = useState(false);
  // A stored team code (returning team) or a connection error asking for one
  // (name collision) both mean the field should just be there already —
  // only a fresh join with nothing to say yet starts it collapsed.
  const show =
    alwaysShow || revealed || Boolean(value) || Boolean(connectionError);

  return show ? (
    <>
      <label
        htmlFor="join-team-code"
        className="mt-2 text-xs font-extrabold tracking-wide text-foreground/55"
      >
        Team code (for returning teams)
      </label>
      <input
        id="join-team-code"
        form={JOIN_FORM_ID}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        placeholder="e.g. QUICK-JADE-FOX"
        className="min-h-14 rounded-2xl border-2 border-foreground/35 bg-white px-4 text-lg font-bold uppercase tracking-widest"
      />
    </>
  ) : onStub ? (
    <Button
      type="button"
      onClick={() => setRevealed(true)}
      className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
    >
      <span className="text-sm font-bold text-foreground/70">
        Played before? Keep this stub.
      </span>
      <span className="flex shrink-0 items-center gap-1 text-xs font-extrabold tracking-[0.2em] whitespace-nowrap uppercase">
        Team code
        <ChevronRightIcon aria-hidden="true" />
      </span>
    </Button>
  ) : (
    <Button
      type="button"
      onClick={() => setRevealed(true)}
      className="mt-2 self-start text-[13px] font-extrabold text-foreground/55 underline"
    >
      Played before? Enter your team code
    </Button>
  );
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
  omitTeamCode = false,
}: JoinFormProps) {
  const [gameCodeRevealed, setGameCodeRevealed] = useState(false);
  // Same query (and cache) as the select below.
  const sessionsQuery = useQuery({
    queryKey: queryKeys.sessions.public(),
    queryFn: fetchPublicSessions,
  });
  // A code that isn't in the game list (an unlisted session, from the QR
  // code) opens the field so the team sees which game they're joining.
  // Latched: once open it stays open while the team edits the code.
  if (
    !gameCodeRevealed &&
    codeInput &&
    sessionsQuery.isSuccess &&
    !sessionsQuery.data.some((session) => session.joinCode === codeInput)
  ) {
    setGameCodeRevealed(true);
  }

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
      <form
        id={JOIN_FORM_ID}
        onSubmit={onSubmit}
        className="flex flex-col gap-2"
      >
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
        {gameCodeRevealed ? (
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
        ) : (
          <Button
            type="button"
            onClick={() => setGameCodeRevealed(true)}
            className="mt-2 self-start text-[13px] font-extrabold text-foreground/55 underline"
          >
            Have a game code?
          </Button>
        )}
        {!omitTeamCode && (
          <TeamCodeField
            value={teamCodeInput}
            onChange={onTeamCodeInputChange}
            connectionError={connectionError}
            alwaysShow={alwaysShowTeamCode}
          />
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
