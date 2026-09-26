import { Header } from '@/app/components/header';

interface TriviaHeaderProps {
  /** Round label (e.g. "ROUND 2"). Omitted on screens that already show their own round text. */
  label?: string;
  /** Round name (e.g. "World Landmarks"), shown centered in the bar. Omitted on screens that already show their own round text. */
  title?: string;
  /** Status badge (e.g. "QUESTION 3"). Omitted on screens with no round/question context. */
  badge?: string;
}

/** Persistent header bar for every /display screen — same "🍺 Trivia Night" bar, with an optional round name centered in the bar and a round/question label + badge on the right for the screens that need one. */
export function TriviaHeader({ label, title, badge }: TriviaHeaderProps) {
  return (
    <Header
      center={
        title && (
          <span className="text-[calc(1.25rem*var(--display-text-scale,1))] font-extrabold">
            {title}
          </span>
        )
      }
    >
      {label && (
        <span className="text-[calc(0.875rem*var(--display-text-scale,1))]">
          {label}
        </span>
      )}
      {badge && (
        <span className="rounded-lg bg-foreground px-3 py-1 text-[calc(0.875rem*var(--display-text-scale,1))] text-background">
          {badge}
        </span>
      )}
    </Header>
  );
}
