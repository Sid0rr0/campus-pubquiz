'use client';

import {
  useState,
  type ElementType,
  type ReactNode,
  type SubmitEvent,
} from 'react';
import { ChevronRightIcon, EnterIcon } from '@radix-ui/react-icons';
import { useQuery } from '@tanstack/react-query';
import { fetchPublicSessions } from '@/app/lib/sessions-api';
import { queryKeys } from '@/app/lib/query-keys';
import type { TeamLinkJoin } from '@/app/lib/use-team-link';
import { Button } from '@/app/components/button';
import { LiveSessionSelect } from '@/app/components/live-session-select';

interface JoinFormProps {
  nameInput: string;
  onNameInputChange: (value: string) => void;
  codeInput: string;
  onCodeInputChange: (value: string) => void;
  connectionError: string | null;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
}

/** The form's id, so `TeamCodeField` on the ticket's stub still submits the join on Enter. */
const JOIN_FORM_ID = 'join-form';

interface TeamCodeFieldProps {
  value: string;
  onChange: (value: string) => void;
  connectionError: string | null;
}

/** The returning team's code: collapsed behind a "Played before?" toggle on a fresh join. */
function TeamCodeField({
  value,
  onChange,
  connectionError,
}: TeamCodeFieldProps) {
  const [revealed, setRevealed] = useState(false);
  // A stored team code (returning team) or a connection error asking for one
  // (name collision) both mean the field should just be there already —
  // only a fresh join with nothing to say yet starts it collapsed.
  const show = revealed || Boolean(value) || Boolean(connectionError);

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
  ) : (
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
  );
}

function JoinForm({
  nameInput,
  onNameInputChange,
  codeInput,
  onCodeInputChange,
  connectionError,
  onSubmit,
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

interface JoinTicketProps {
  join: Pick<
    TeamLinkJoin,
    | 'nameInput'
    | 'setNameInput'
    | 'codeInput'
    | 'setCodeInput'
    | 'teamCodeInput'
    | 'setTeamCodeInput'
    | 'connectionError'
    | 'needsJoinForm'
    | 'handleJoin'
  >;
  /** The heading's level: /play has no other heading, so its ticket is the page's h1. */
  headingTag?: ElementType;
  /** Replaces the form once a team no longer needs it (the home page's connecting and joined states). */
  children?: ReactNode;
}

/**
 * The join card shared by the home page and /play: the header strip, the join
 * form, and a returning team's code on the tear-off stub below the Join button.
 */
export function JoinTicket({
  join,
  headingTag: Heading = 'h2',
  children,
}: JoinTicketProps) {
  return (
    <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-foreground/15 bg-white shadow-[0_16px_36px_rgba(46,49,146,0.1)]">
      <div className="bg-magenta px-6 py-4 text-white sm:py-5">
        <Heading className="font-display text-3xl leading-tight sm:text-4xl">
          Join live game
        </Heading>
      </div>

      <div className="px-6 pb-6 pt-4 sm:pt-5">
        {join.needsJoinForm ? (
          <JoinForm
            nameInput={join.nameInput}
            onNameInputChange={join.setNameInput}
            codeInput={join.codeInput}
            onCodeInputChange={join.setCodeInput}
            connectionError={join.connectionError}
            onSubmit={join.handleJoin}
          />
        ) : (
          children
        )}
      </div>

      {join.needsJoinForm && (
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
            value={join.teamCodeInput}
            onChange={join.setTeamCodeInput}
            connectionError={join.connectionError}
          />
        </div>
      )}
    </div>
  );
}
