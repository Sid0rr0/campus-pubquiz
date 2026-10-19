'use client';

import { useEffect, useState, type SubmitEvent } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/app/components/button';
import { apiErrorMessage } from '@/app/lib/api-error-message';
import { queryKeys } from '@/app/lib/query-keys';
import { readStoredIdentity } from '@/app/lib/team-storage';
import { fetchTeamPage, TeamsApiError } from '@/app/lib/teams-api';
import { SummaryTiles } from '@/app/teams/[id]/team-detail-panel';
import { TeamSessionsTable } from '@/app/teams/[id]/team-sessions-table';

function CodeForm({
  error,
  onSubmit,
}: {
  error: string | null;
  onSubmit: (code: string) => void;
}) {
  const [input, setInput] = useState('');

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = input.trim();
    if (code) onSubmit(code);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-4 bg-background p-6 text-foreground">
      <h1 className="font-display text-2xl">Our team page</h1>
      <p className="text-foreground/70">
        Enter your team code to see your history and each night&apos;s answers.
      </p>
      {error && (
        <p role="alert" className="font-extrabold text-magenta">
          {error}
        </p>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <label
          htmlFor="team-page-code"
          className="text-xs font-extrabold tracking-wide text-foreground/55"
        >
          Team code
        </label>
        <input
          id="team-page-code"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="e.g. QUICK-JADE-FOX"
          className="min-h-14 rounded-2xl border-2 border-foreground/35 bg-white px-4 text-lg font-bold uppercase tracking-widest"
        />
        <Button
          type="submit"
          variant="solid"
          className="mt-2 min-h-14 rounded-2xl text-lg"
        >
          Open team page
        </Button>
      </form>
    </main>
  );
}

function CenteredMessage({ children }: { children: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <p className="font-display text-xl">{children}</p>
    </main>
  );
}

/**
 * A team's own history, opened with its team code: the phone's stored code
 * when it has one, otherwise a code typed here. A typed code is kept in
 * memory only and never put in a URL.
 */
export function TeamPagePanel() {
  // undefined until localStorage has been read after mount.
  const [storedCode, setStoredCode] = useState<string | null | undefined>(
    undefined,
  );
  const [enteredCode, setEnteredCode] = useState<string | null>(null);

  useEffect(() => {
    // Reading localStorage is only possible in the browser, after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStoredCode(readStoredIdentity().teamCode ?? null);
  }, []);

  const code = enteredCode ?? storedCode ?? null;
  const pageQuery = useQuery({
    queryKey: queryKeys.teams.page(code ?? ''),
    queryFn: ({ signal }) => fetchTeamPage(code!, signal),
    enabled: code !== null,
    retry: false,
  });

  if (storedCode === undefined)
    return <CenteredMessage>Loading…</CenteredMessage>;

  const data = pageQuery.data ?? null;
  if (!data) {
    const error = apiErrorMessage(
      pageQuery.error,
      TeamsApiError,
      'Could not load team page',
    );
    if (code === null || error) {
      return <CodeForm error={error} onSubmit={setEnteredCode} />;
    }
    return <CenteredMessage>Loading…</CenteredMessage>;
  }

  return (
    <main className="flex min-h-screen flex-col gap-6 bg-background p-6 text-foreground">
      <div className="flex flex-col gap-1">
        <Link
          href="/play"
          className="text-sm text-foreground/60 underline-offset-2 hover:underline"
        >
          ← Back to the quiz
        </Link>
        <h1 className="font-display text-2xl">{data.name}</h1>
      </div>

      {data.sessions.length === 0 ? (
        <p className="text-foreground/60">
          This team hasn&apos;t played an ended session yet.
        </p>
      ) : (
        <>
          <SummaryTiles summary={data.summary} />
          <section className="flex flex-col gap-2">
            <h2 className="font-display text-lg">Sessions</h2>
            <TeamSessionsTable sessions={data.sessions} sessionHref={noHref} />
          </section>
        </>
      )}
    </main>
  );
}

/** Teams have no stats page per session, so session names are plain text. */
function noHref(): null {
  return null;
}
