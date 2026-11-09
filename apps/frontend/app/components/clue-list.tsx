/** A Clue question's clues in the order they were shown, numbered; it grows with each step. */
export function ClueList({
  clues,
  className = '',
}: {
  clues: readonly string[];
  className?: string;
}) {
  return (
    <ol
      aria-label="Clues"
      className={`flex w-full max-w-[calc(56rem*var(--display-text-scale,1))] flex-col gap-3 text-left ${className}`}
    >
      {clues.map((clue, index) => (
        <li
          key={index}
          className="flex items-baseline gap-3 rounded-xl border-2 border-cyan bg-white px-5 py-3 font-bold"
        >
          <span className="font-display text-cyan">{index + 1}</span>
          <span className="text-foreground">{clue}</span>
        </li>
      ))}
    </ol>
  );
}
