'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useGameSocket } from '@/app/lib/use-game-socket';
import { RulesContent } from '@/app/components/rules-content';

function RulesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Reachable any time with no code at all (e.g. bookmarked, or shared before
  // a game exists) — in that case this renders the static house rules with
  // no round/topic/break sentence, rather than blocking forever on a socket
  // connection to a session that may not exist.
  const codeFromUrl = searchParams.get('code') ?? undefined;
  const { snapshot, connectionError } = useGameSocket(
    'players',
    Boolean(codeFromUrl),
    codeFromUrl,
  );

  // An unknown/stale code still needs to fall back to the static rules
  // rather than get stuck, so this only strips the bad ?code= from the
  // address bar rather than navigating away.
  useEffect(() => {
    if (codeFromUrl && connectionError) {
      router.replace('/rules');
    }
  }, [codeFromUrl, connectionError, router]);

  if (codeFromUrl && !connectionError && !snapshot) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <p className="font-display text-xl">Connecting…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-10 text-foreground">
      <RulesContent
        quizStructure={snapshot?.quizStructure}
        rules={snapshot?.settings?.rules}
      />
    </main>
  );
}

export default function RulesPage() {
  // useSearchParams requires a Suspense boundary during static prerendering.
  return (
    <Suspense fallback={null}>
      <RulesPageContent />
    </Suspense>
  );
}
