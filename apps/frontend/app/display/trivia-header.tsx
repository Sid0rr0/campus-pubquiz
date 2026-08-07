import { Header } from "@/app/components/header";

interface TriviaHeaderProps {
  /** Round label (e.g. "ROUND 2"). Omitted on screens that already show their own round text. */
  label?: string;
  /** Status badge (e.g. "QUESTION 3"). Omitted on screens with no round/question context. */
  badge?: string;
}

/** Persistent header bar for every /display screen — same "🍺 Trivia Night" bar, with an optional round/question badge for the screens that need one. */
export function TriviaHeader({ label, badge }: TriviaHeaderProps) {
  return (
    <Header>
      {(label || badge) && (
        <div className="flex items-center gap-3 text-sm font-extrabold tracking-wide">
          {label && <span className="text-foreground/55">{label}</span>}
          {badge && <span className="rounded-lg bg-foreground px-3 py-1 text-background">{badge}</span>}
        </div>
      )}
    </Header>
  );
}
