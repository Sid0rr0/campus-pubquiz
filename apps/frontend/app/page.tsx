'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { HowItWorks } from '@/app/components/how-it-works';
import { JoinPanel } from '@/app/components/join-panel';

const FEATURES = [
  'Answer from your phone, no paper sheets',
  'Change answers until the block locks',
  'Picture, audio and video questions',
  'Live leaderboard on the big screen',
  'Every night counts toward the league',
];

function HomePageContent() {
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get('code') ?? '';

  return (
    <div className="flex flex-1 flex-col">
      <header className="bg-foreground px-6 pb-18 pt-6 text-background sm:pb-28 sm:pt-14">
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-[1.1fr_1fr] md:items-center md:gap-14">
          <div className="text-center md:text-left">
            <h1 className="font-display text-4xl leading-none text-balance sm:text-7xl">
              Campus Pub Quiz
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm font-semibold text-background/85 sm:mt-5 sm:text-lg md:mx-0">
              Grab a table, round up your smartest friends, and battle it out
              for bragging rights (and the tab).
            </p>
          </div>
          <ul className="mx-auto grid w-fit gap-y-0.5 text-sm font-bold text-background/80 md:mx-0 md:block md:w-auto md:divide-y md:divide-background/20 md:text-base md:text-background/90">
            {FEATURES.map((feature) => (
              <li key={feature} className="flex items-center gap-2 md:py-2.5">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-yellow"
                />
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </header>
      <JoinPanel codeFromUrl={codeFromUrl} />
      <HowItWorks />
      <footer className="mt-auto px-5 pb-8 pt-12 text-center text-sm font-bold text-foreground/55">
        Running the quiz tonight?{' '}
        <Link
          href="/login"
          className="font-extrabold text-foreground underline underline-offset-2"
        >
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
