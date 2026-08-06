'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { HowItWorks } from '@/app/components/how-it-works';
import { JoinPanel } from '@/app/components/join-panel';

function HomePageContent() {
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get('code') ?? '';

  return (
    <div className="flex flex-1 flex-col">
      <header className="bg-foreground px-6 pb-22 pt-16 text-center text-background">
        <h1 className="font-display text-5xl leading-tight sm:text-7xl">Campus Pub Quiz</h1>
        <p className="mx-auto mt-4 max-w-md text-lg font-semibold text-background/85">
          Grab a table, round up your smartest friends, and battle it out for bragging rights (and the tab).
        </p>
      </header>
      <HowItWorks />
      <JoinPanel codeFromUrl={codeFromUrl} />
      <footer className="px-5 pb-8 text-center text-sm font-bold text-foreground/50">
        Running the quiz tonight?{' '}
        <Link href="/login" className="font-extrabold text-foreground underline">
          Quiz master login
        </Link>
      </footer>
    </div>
  );
}

export default function HomePage() {
  // useSearchParams requires a Suspense boundary during static prerendering.
  return (
    <Suspense fallback={null}>
      <HomePageContent />
    </Suspense>
  );
}
