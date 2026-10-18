import { EntranceLine } from '@/app/components/round-title-entrance';

interface RoundTitleCardProps {
  label: string;
  roundTitle: string;
  author?: string | null;
  /** The round note, when the view carries it — drawn as text under the title and author. */
  note?: string | null;
}

/** A round's name on the big screen before its content: shared by round_title, break_round_title and reveal_intro. */
export function RoundTitleCard({
  label,
  roundTitle,
  author,
  note,
}: RoundTitleCardProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-16 text-center">
      <EntranceLine line="kicker">
        <p className="text-display-sm font-extrabold tracking-wide text-foreground/55">
          {label}
        </p>
      </EntranceLine>
      <EntranceLine line="title" className="flex flex-col items-center gap-4">
        <h1 className="text-balance font-display text-display-6xl text-magenta">
          {roundTitle}
        </h1>
        {author && (
          <p className="text-display-lg font-bold text-foreground/60">
            by {author}
          </p>
        )}
        {note && (
          <p className="max-w-5xl whitespace-pre-line text-display-xl font-bold text-foreground/80">
            {note}
          </p>
        )}
      </EntranceLine>
    </div>
  );
}
