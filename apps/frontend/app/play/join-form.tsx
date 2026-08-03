import type { FormEvent } from 'react';

interface JoinFormProps {
  nameInput: string;
  onNameInputChange: (value: string) => void;
  codeInput: string;
  onCodeInputChange: (value: string) => void;
  teamCodeInput: string;
  onTeamCodeInputChange: (value: string) => void;
  connectionError: string | null;
  hasStoredIdentity: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onLogOut: () => void;
}

export function JoinForm({
  nameInput,
  onNameInputChange,
  codeInput,
  onCodeInputChange,
  teamCodeInput,
  onTeamCodeInputChange,
  connectionError,
  hasStoredIdentity,
  onSubmit,
  onLogOut,
}: JoinFormProps) {
  return (
    <main className="flex min-h-screen flex-col justify-center gap-4 bg-background px-7 py-10 text-foreground">
      <h1 className="text-center font-display text-3xl text-magenta">🍺 Join the quiz</h1>
      <p className="-mt-2 text-center text-sm text-foreground/65">Grab a table, pick a name</p>
      {connectionError && (
        <p role="alert" className="text-center font-extrabold text-magenta">
          {connectionError}
        </p>
      )}
      <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-2">
        <label htmlFor="team-name" className="text-xs font-extrabold tracking-wide text-foreground/55">
          Team name
        </label>
        <input
          id="team-name"
          value={nameInput}
          onChange={(event) => onNameInputChange(event.target.value)}
          className="min-h-14 rounded-2xl border-2 border-foreground/35 bg-white px-4 text-lg font-bold"
        />
        <label htmlFor="game-code" className="mt-2 text-xs font-extrabold tracking-wide text-foreground/55">
          Game code
        </label>
        <input
          id="game-code"
          value={codeInput}
          onChange={(event) => onCodeInputChange(event.target.value)}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="e.g. ABC234"
          className="min-h-14 rounded-2xl border-2 border-foreground/35 bg-white px-4 text-lg font-bold uppercase tracking-widest"
        />
        <label htmlFor="team-code" className="mt-2 text-xs font-extrabold tracking-wide text-foreground/55">
          Team code (only if this team has played before)
        </label>
        <input
          id="team-code"
          value={teamCodeInput}
          onChange={(event) => onTeamCodeInputChange(event.target.value)}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="e.g. QZX456"
          className="min-h-14 rounded-2xl border-2 border-foreground/35 bg-white px-4 text-lg font-bold uppercase tracking-widest"
        />
        <button
          type="submit"
          className="mt-2 min-h-14 rounded-2xl bg-magenta font-display text-lg text-white shadow-[0_3px_0_#b8006d]"
        >
          Join the quiz
        </button>
      </form>
      {hasStoredIdentity && (
        <button
          type="button"
          onClick={onLogOut}
          className="mx-auto text-xs font-extrabold text-foreground/45 underline"
        >
          Log out
        </button>
      )}
    </main>
  );
}
