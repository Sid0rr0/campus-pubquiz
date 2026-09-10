interface RoundOverviewScreenProps {
  roundTitles: string[];
}

/** Shown once, right after the admin dismisses 'rules' and before round 0's own 'round_intro' card — lists every round's title up front. */
export function RoundOverviewScreen({ roundTitles }: RoundOverviewScreenProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-16 text-center">
      <h1 className="font-display text-[calc(1.875rem*var(--display-text-scale,1))]">
        <span className="text-magenta">Rounds</span>
      </h1>
      <ol className="mx-auto flex max-w-[calc(36rem*var(--display-text-scale,1))] flex-col gap-3 text-left">
        {roundTitles.map((title, index) => (
          <li
            key={`${index}-${title}`}
            className="flex items-start gap-3 text-[calc(1.5rem*var(--display-text-scale,1))] font-bold"
          >
            <span aria-hidden="true" className="text-cyan">
              {index + 1}.
            </span>
            <span>{title}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
