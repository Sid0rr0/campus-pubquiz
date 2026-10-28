import { EntranceLine } from '@/app/components/round-title-entrance';

interface RoundTitleCardProps {
  label: string;
  roundTitle: string;
  author?: string | null;
  /** The round note, when the view carries it — drawn as text under the title and author. */
  note?: string | null;
}

/** A round's name on the big screen before its content: shared by round_title, break_round_title and reveal_intro. Drawn on a full-bleed ink stage, the night's between-rounds peak. */
export function RoundTitleCard({
  label,
  roundTitle,
  author,
  note,
}: RoundTitleCardProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10 bg-foreground px-24 text-center text-background">
      <EntranceLine line="title" className="flex flex-col items-center gap-6">
        <h1 className="max-w-[18ch] text-balance font-display text-display-8xl leading-[1.05]">
          {roundTitle}
        </h1>
        {author && (
          <p className="text-display-2xl font-bold text-background/70">
            by {author}
          </p>
        )}
        {note && (
          <p className="max-w-5xl whitespace-pre-line text-display-2xl font-bold text-background/85">
            {note}
          </p>
        )}
      </EntranceLine>
      <EntranceLine line="kicker">
        <p className="rounded-xl bg-magenta px-6 py-2 text-display-xl font-extrabold tracking-wide text-white">
          {label}
        </p>
      </EntranceLine>
    </div>
  );
}
