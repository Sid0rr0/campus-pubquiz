'use client';

import { useEffect, useState, type SubmitEvent } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/app/components/button';
import { apiErrorMessage } from '@/app/lib/api-error-message';
import { ordinal } from '@/app/lib/placing-text';
import { queryKeys } from '@/app/lib/query-keys';
import { readStoredIdentity } from '@/app/lib/team-storage';
import type { TeamNightQuestion, Verdict } from '@campus-pubquiz/types';
import {
  fetchTeamNight,
  fetchTeamPage,
  TeamsApiError,
} from '@/app/lib/teams-api';
import { SummaryTiles } from '@/app/teams/[id]/summary-tiles';
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

const VERDICT_LABEL: Record<Verdict, string> = {
  correct: 'Correct',
  partial: 'Partly right',
  incorrect: 'Incorrect',
};

function NightQuestionItem({ question }: { question: TeamNightQuestion }) {
  return (
    <li className="flex flex-col gap-2 rounded-2xl border-2 border-foreground/15 bg-white p-4">
      <p className="text-xs font-extrabold tracking-wide text-foreground/55">
        <span>{question.roundTitle}</span> · Question {question.questionNumber}
      </p>
      <p className="font-bold">{question.prompt}</p>
      <div data-answer-kind={question.answerKind} className="flex flex-col">
        <span className="text-xs text-foreground/55">Your answer</span>
        {question.teamAnswer === null ? (
          <span className="italic text-foreground/60">No answer</span>
        ) : (
          <span className="font-bold">{question.teamAnswer}</span>
        )}
      </div>
      <div className="flex flex-col">
        <span className="text-xs text-foreground/55">Right answer</span>
        <span className="font-bold">{question.correctAnswer}</span>
      </div>
      <p className="flex gap-3 text-sm">
        {question.verdict !== null && (
          <span className="font-extrabold">
            {VERDICT_LABEL[question.verdict]}
          </span>
        )}
        <span>
          {question.pointsAwarded} / {question.points}
        </span>
      </p>
    </li>
  );
}

function NightDetail({
  code,
  gameSessionId,
  onBack,
  onChangeCode,
}: {
  code: string;
  gameSessionId: number;
  onBack: () => void;
  onChangeCode: () => void;
}) {
  const nightQuery = useQuery({
    queryKey: queryKeys.teams.night(code, gameSessionId),
    queryFn: ({ signal }) => fetchTeamNight(code, gameSessionId, signal),
    retry: false,
  });
  const error = apiErrorMessage(
    nightQuery.error,
    TeamsApiError,
    'Could not load this night',
  );

  return (
    <main className="flex min-h-screen flex-col gap-4 bg-background p-6 text-foreground">
      <button
        type="button"
        onClick={onBack}
        className="self-start text-sm text-foreground/60 underline-offset-2 hover:underline"
      >
        ← Back to history
      </button>
      {error && (
        <>
          <p role="alert" className="font-extrabold text-magenta">
            {error}
          </p>
          <button
            type="button"
            onClick={onChangeCode}
            className="self-start text-sm underline underline-offset-2"
          >
            Use a different team code
          </button>
        </>
      )}
      {nightQuery.data && (
        <>
          <h1 className="font-display text-2xl">{nightQuery.data.name}</h1>
          <ol className="flex flex-col gap-3">
            {nightQuery.data.questions.map((question) => (
              <NightQuestionItem
                key={question.questionId}
                question={question}
              />
            ))}
          </ol>
        </>
      )}
      {!error && !nightQuery.data && <p>Loading…</p>}
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
  const [openSessionId, setOpenSessionId] = useState<number | null>(null);

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

  if (openSessionId !== null && code !== null) {
    return (
      <NightDetail
        code={code}
        gameSessionId={openSessionId}
        onBack={() => setOpenSessionId(null)}
        onChangeCode={() => {
          setOpenSessionId(null);
          setEnteredCode(null);
          setStoredCode(null);
        }}
      />
    );
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

      {data.leagues.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-lg">Leagues</h2>
          <ul className="flex flex-col gap-2">
            {data.leagues.map((league) => (
              <li
                key={league.leagueId}
                className="flex flex-col rounded-2xl border-2 border-foreground/15 bg-white p-4"
              >
                <span className="font-bold">{league.leagueName}</span>
                <span>
                  {league.shared ? 'Joint ' : ''}
                  {ordinal(league.position)} of {league.teamCount} ·{' '}
                  {league.leaguePoints} pts
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.sessions.length === 0 ? (
        <p className="text-foreground/60">
          This team hasn&apos;t played an ended session yet.
        </p>
      ) : (
        <>
          <SummaryTiles summary={data.summary} />
          <section className="flex flex-col gap-2">
            <h2 className="font-display text-lg">Sessions</h2>
            <TeamSessionsTable
              sessions={data.sessions}
              onOpenSession={setOpenSessionId}
            />
          </section>
        </>
      )}
    </main>
  );
}
