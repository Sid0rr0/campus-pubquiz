interface BreakIntroScreenProps {
  roundNumber: number;
}

/** Shown once right when a block locks, before the grading-review view — same round_intro-style treatment, but for "BREAK" instead of a round's name. */
export function BreakIntroScreen({ roundNumber }: BreakIntroScreenProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-16 text-center">
      <p className="text-sm font-extrabold tracking-wide text-foreground/55">
        ROUND {roundNumber}
      </p>
      <h1 className="text-balance font-display text-6xl text-magenta">BREAK</h1>
    </div>
  );
}
