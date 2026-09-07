'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { RevealQuestionView } from '@campus-pubquiz/types';
import { useGameSocket } from '@/app/lib/use-game-socket';
import { useAuth } from '@/app/lib/use-auth';
import { getAdvanceGating } from '@/app/control/advance-gating';
import { NavigationButtons } from '@/app/control/navigation-buttons';

/**
 * 0-based index of the round the current block started at, derived from
 * quizStructure.breakRoundNumbers (already on every snapshot) rather than a
 * separate REST fetch of the quiz's round shape — /remote only needs this
 * for NavigationButtons' break_round_intro Previous-button nuance.
 */
function getActiveBlockStartIndex(
  roundIndex: number,
  breakRoundNumbers: number[],
): number {
  return breakRoundNumbers.filter((number) => number <= roundIndex).at(-1) ?? 0;
}

function NextQuestionPreview({ question }: { question: RevealQuestionView }) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="text-xs font-extrabold tracking-wide text-magenta uppercase">
        {question.type.replace(/_/g, ' ')} — {question.points} pt
        {question.points === 1 ? '' : 's'}
      </p>
      <p className="font-bold">{question.prompt}</p>
      {question.options && question.options.length > 0 && (
        <ul className="list-disc pl-5">
          {question.options.map((option) => (
            <li key={option}>{option}</li>
          ))}
        </ul>
      )}
      {question.mediaUrl && (
        <p className="text-xs break-all text-foreground/70">
          Media: {question.mediaUrl}
        </p>
      )}
      <p className="text-xs text-foreground/70">
        Answer: <span className="font-bold">{question.answer}</span>
      </p>
    </div>
  );
}

function RemotePageContent() {
  const auth = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionCode = searchParams.get('code');
  const isAuthenticated = auth.status === 'authenticated';

  // Mirrors /control's connectJoinCode pattern: only adopts a new ?code=
  // when it points at a session the socket doesn't already know about, so
  // an already-matching snapshot never forces a pointless reconnect.
  const [connectJoinCode, setConnectJoinCode] = useState<string | null>(
    sessionCode,
  );

  const { snapshot, connectionError, sendAction, presenterContext } =
    useGameSocket(
      'admin',
      isAuthenticated && Boolean(connectJoinCode),
      connectJoinCode ?? undefined,
    );
  const connectedJoinCode = snapshot?.joinCode;

  const [prevSessionCode, setPrevSessionCode] = useState(sessionCode);
  if (sessionCode !== prevSessionCode) {
    setPrevSessionCode(sessionCode);
    if (sessionCode && sessionCode !== connectedJoinCode) {
      setConnectJoinCode(sessionCode);
    }
  }

  useEffect(() => {
    if (snapshot && snapshot.joinCode !== sessionCode) {
      router.replace(`/remote?code=${snapshot.joinCode}`);
    }
  }, [snapshot, sessionCode, router]);

  useEffect(() => {
    if (isAuthenticated && !sessionCode) {
      router.replace('/sessions');
    }
  }, [isAuthenticated, sessionCode, router]);

  const codeFromUrl = searchParams.get('code') ?? undefined;
  useEffect(() => {
    if (codeFromUrl && connectionError && !snapshot) {
      router.replace('/sessions');
    }
  }, [codeFromUrl, connectionError, snapshot, router]);

  useEffect(() => {
    if (auth.status === 'unauthenticated' || auth.status === 'pending') {
      router.replace('/login');
    }
  }, [auth.status, router]);

  if (
    auth.status === 'checking' ||
    auth.status === 'unauthenticated' ||
    auth.status === 'pending'
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <p className="font-display text-xl">Loading…</p>
      </main>
    );
  }

  if (!sessionCode) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <p className="font-display text-xl">Loading…</p>
      </main>
    );
  }

  if (!snapshot) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-foreground">
        {connectionError && (
          <p role="alert" className="font-extrabold text-magenta">
            {connectionError}
          </p>
        )}
        <p className="font-display text-xl">Connecting…</p>
      </main>
    );
  }

  const { progress, joinCode } = snapshot;
  const gameStatus = progress.status;
  const hasActiveShowdown = snapshot.activeShowdown != null;
  const showdownRevealStep = snapshot.showdownRevealStep ?? 0;
  const revealIndex = progress.revealIndex ?? 0;
  const activeBlockStartIndex = getActiveBlockStartIndex(
    progress.roundIndex,
    snapshot.quizStructure.breakRoundNumbers,
  );
  const { canAdvance, canGoToPreviousQuestion } = getAdvanceGating({
    gameStatus,
    hasActiveShowdown,
    showdownRevealStep,
    revealIndex,
    activeBlockStartIndex,
    previousStatus: progress.previousStatus,
  });
  const leaderboardTeamCount = snapshot.leaderboard?.length ?? 0;
  const leaderboardRevealCount = snapshot.leaderboardRevealCount ?? 0;

  return (
    <main className="flex min-h-screen flex-col gap-4 bg-background p-4 pb-28 text-foreground">
      {connectionError && (
        <p role="alert" className="font-extrabold text-magenta">
          {connectionError}
        </p>
      )}
      <div className="flex flex-col gap-1">
        <p className="font-display text-lg">Presenter Remote</p>
        <p className="text-sm font-bold">
          {joinCode} · {gameStatus} · R{progress.roundIndex + 1}Q
          {progress.questionIndex + 1}
        </p>
      </div>

      <section className="flex flex-col gap-2 rounded-lg border-2 border-foreground/10 p-3">
        <h2 className="text-xs font-extrabold tracking-wide text-magenta uppercase">
          Notes
        </h2>
        {presenterContext?.currentQuestionNotes ? (
          <p className="text-sm">{presenterContext.currentQuestionNotes}</p>
        ) : (
          <p className="text-sm text-foreground/50">
            No notes for this question.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2 rounded-lg border-2 border-foreground/10 p-3">
        <h2 className="text-xs font-extrabold tracking-wide text-magenta uppercase">
          Up next
        </h2>
        {presenterContext?.nextQuestion ? (
          <NextQuestionPreview question={presenterContext.nextQuestion} />
        ) : (
          <p className="text-sm text-foreground/50">Nothing queued yet.</p>
        )}
      </section>

      <div className="fixed inset-x-0 bottom-0 border-t-2 border-foreground/10 bg-background p-3">
        <NavigationButtons
          progressStatus={gameStatus}
          canGoToPreviousQuestion={canGoToPreviousQuestion}
          canAdvance={canAdvance}
          isLeaderboardVisible={progress.isLeaderboardVisible}
          leaderboardRevealCount={leaderboardRevealCount}
          leaderboardTeamCount={leaderboardTeamCount}
          onAction={sendAction}
        />
      </div>
    </main>
  );
}

export default function RemotePage() {
  // useSearchParams requires a Suspense boundary during static prerendering.
  return (
    <Suspense fallback={null}>
      <RemotePageContent />
    </Suspense>
  );
}
