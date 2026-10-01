interface RoundTitleCardProps {
  label: string;
  roundTitle: string;
  author?: string | null;
}

/** A round's name on the big screen before its content: shared by round_title, break_round_title and reveal_intro. */
export function RoundTitleCard({
  label,
  roundTitle,
  author,
}: RoundTitleCardProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-16 text-center">
      <p className="text-display-sm font-extrabold tracking-wide text-foreground/55">
        {label}
      </p>
      <h1 className="text-balance font-display text-display-6xl text-magenta">
        {roundTitle}
      </h1>
      {author && (
        <p className="text-display-lg font-bold text-foreground/60">
          by {author}
        </p>
      )}
    </div>
  );
}
