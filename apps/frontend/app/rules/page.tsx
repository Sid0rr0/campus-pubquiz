'use client';

import { useGameSocket } from '@/app/lib/use-game-socket';
import { RulesContent } from '@/app/components/rules-content';

export default function RulesPage() {
  const { snapshot } = useGameSocket('players');

  if (!snapshot) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <p className="font-display text-xl">Connecting…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-10 text-foreground">
      <RulesContent quizStructure={snapshot.quizStructure} />
    </main>
  );
}
