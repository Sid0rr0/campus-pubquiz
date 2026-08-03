interface TriviaHeaderProps {
  label: string;
  badge: string;
}

/** Shared header bar for question_open/break/reveal — same "🍺 Trivia Night" bar with a status label and a round/question badge. */
export function TriviaHeader({ label, badge }: TriviaHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b-2 border-dashed border-foreground/30 px-8 py-4">
      <div className="font-display text-lg text-magenta">🍺 Trivia Night</div>
      <div className="flex items-center gap-3 text-sm font-extrabold tracking-wide">
        <span className="text-foreground/55">{label}</span>
        <span className="rounded-lg bg-foreground px-3 py-1 text-background">{badge}</span>
      </div>
    </div>
  );
}
