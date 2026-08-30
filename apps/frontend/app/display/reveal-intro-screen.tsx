interface RevealIntroScreenProps {
  roundNumber: number;
  roundTitle: string;
}

/** Shown once per round before its answers start revealing — same treatment as round_intro before its questions open. */
export function RevealIntroScreen({
  roundNumber,
  roundTitle,
}: RevealIntroScreenProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-16 text-center">
      <p className="text-lg font-extrabold tracking-wide text-foreground/55">
        REVEALING ANSWERS · ROUND {roundNumber}
      </p>
      <h1 className="text-balance font-display text-6xl text-magenta">
        {roundTitle}
      </h1>
    </div>
  );
}
