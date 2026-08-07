interface BreakRoundIntroScreenProps {
  roundNumber: number;
  roundTitle: string;
}

/**
 * Shown while walking Previous backward through break review, whenever
 * revealIndex crosses into a round's first question — same treatment as
 * round_intro/reveal_intro, but reached from the pre-reveal grading side, so
 * it never implies an answer is about to show (unlike reveal_intro).
 */
export function BreakRoundIntroScreen({ roundNumber, roundTitle }: BreakRoundIntroScreenProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-16 text-center">
      <p className="text-sm font-extrabold tracking-wide text-foreground/55">
        ROUND {roundNumber}
      </p>
      <h1 className="text-balance font-display text-6xl text-magenta">{roundTitle}</h1>
    </div>
  );
}
