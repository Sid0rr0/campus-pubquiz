import type { GameStatus, QuizSummaryRound } from '@campus-pubquiz/types';

/** Kind label of the on-air title card, by game status; other statuses have none. */
const TITLE_CARD_KINDS: Partial<Record<GameStatus, string>> = {
  round_intro: 'Round intro',
  round_overview: 'Round intro',
  reveal_intro: 'Reveal intro',
  break_round_intro: 'Break review: round intro',
};

export function titleCardKindLabel(status: GameStatus): string | undefined {
  return TITLE_CARD_KINDS[status];
}

interface RoundCardDetailProps {
  item: { kind: 'title' | 'break'; roundIndex: number };
  rounds: QuizSummaryRound[];
  /** Set only while this is the card on air; a browsed card has no kind. */
  kindLabel?: string;
}

export function RoundCardDetail({
  item,
  rounds,
  kindLabel,
}: RoundCardDetailProps) {
  const round = rounds[item.roundIndex];
  if (!round) return null;

  if (item.kind === 'break') {
    return (
      <section aria-label="Break card" className="flex flex-col gap-1">
        <h2 className="font-display text-xl">
          Break {round.breakNumber}
          {round.isFinalBreak ? ' (final)' : ''}
        </h2>
      </section>
    );
  }

  return (
    <section
      aria-label="Title card"
      className="flex flex-col gap-1 break-words"
    >
      {kindLabel && (
        <p className="text-xs font-extrabold tracking-wide text-foreground/55">
          {kindLabel}
        </p>
      )}
      <h2 className="font-display text-xl">
        Round {item.roundIndex + 1}: {round.title}
      </h2>
      {round.category && (
        <p className="text-sm">
          <span className="font-extrabold">Category:</span> {round.category}
        </p>
      )}
      {round.author && (
        <p className="text-sm">
          <span className="font-extrabold">Author:</span> {round.author}
        </p>
      )}
      {round.note && (
        <p className="flex flex-col text-sm whitespace-pre-line text-foreground/70">
          <span className="text-[10px] font-extrabold tracking-wide text-foreground/40 uppercase">
            Round note
          </span>
          {round.note}
        </p>
      )}
    </section>
  );
}
