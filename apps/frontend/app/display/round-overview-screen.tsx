interface RoundOverviewScreenProps {
  roundTitles: string[];
  /** Parallel to roundTitles, '' where a round has no category set. */
  roundCategories: string[];
  /** Parallel to roundTitles, '' where a round has no author set. */
  roundAuthors: string[];
}

/** Shown once, right after the admin dismisses 'rules' and before round 0's own 'round_intro' card — lists every round's title up front. */
export function RoundOverviewScreen({
  roundTitles,
  roundCategories,
  roundAuthors,
}: RoundOverviewScreenProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-16 text-center">
      <h1 className="font-display text-display-3xl">
        <span className="text-magenta">Rounds</span>
      </h1>
      <ol className="mx-auto flex max-w-[calc(36rem*var(--display-text-scale,1))] flex-col gap-3 text-left">
        {roundTitles.map((title, index) => {
          const category = roundCategories[index];
          const author = roundAuthors[index];
          return (
            <li
              key={`${index}-${title}`}
              className="flex items-start gap-3 text-display-2xl font-bold"
            >
              <span aria-hidden="true" className="text-cyan">
                {index + 1}.
              </span>
              <span>
                <span>{title}</span>
                {category && <span className="ml-2 text-cyan">{category}</span>}
                {author && (
                  <span className="block text-display-base font-bold text-foreground/60">
                    by {author}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
