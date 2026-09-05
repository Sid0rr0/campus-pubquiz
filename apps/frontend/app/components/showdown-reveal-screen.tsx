import type { ActiveShowdownView } from '@campus-pubquiz/types';

interface ShowdownRevealScreenProps {
  activeShowdown: ActiveShowdownView;
  /** 0..(participants.length + 1) — the same reveal-step counter driving StateSnapshotPayload.showdownRevealStep. */
  step: number;
}

// Shared by /display and /play so both surfaces build up the same reveal in
// lockstep, driven by the admin's ADVANCE/PREVIOUS presses — mirrors
// ClosestGuessRevealScreen's cumulative-disclosure layout, but for however
// many participants ended up tied (2, 3, or more), not a fixed pair. Each
// step adds one more team's guess, in seatIndex order, then the final step
// adds the correct answer and marks the winner (or "It's a tie!").
export function ShowdownRevealScreen({
  activeShowdown,
  step,
}: ShowdownRevealScreenProps) {
  const { question, participants } = activeShowdown;
  const showAnswer = activeShowdown.answer !== undefined;

  return (
    <>
      <p className="text-[calc(0.875rem*var(--display-text-scale,1))] font-extrabold tracking-wide text-foreground/55">
        SHOWDOWN TIEBREAKER
      </p>
      <h1 className="text-balance font-display text-[calc(2.25rem*var(--display-text-scale,1))] leading-snug">
        {question}
      </h1>
      <ul className="flex w-full max-w-xl flex-col gap-3 text-left">
        {participants.map((participant) => {
          const isRevealed = step >= participant.seatIndex + 1;
          const isWinner =
            showAnswer && activeShowdown.winnerTeamId === participant.teamId;
          return (
            <li
              key={participant.teamId}
              className={
                isWinner
                  ? 'flex items-center justify-between gap-3 rounded-xl border-2 border-green bg-white px-5 py-3 text-[calc(1.25rem*var(--display-text-scale,1))] font-bold text-foreground'
                  : 'flex items-center justify-between gap-3 rounded-xl border-2 border-foreground/20 bg-white px-5 py-3 text-[calc(1.25rem*var(--display-text-scale,1))] font-bold text-foreground'
              }
            >
              <span>{participant.teamName}</span>
              {isRevealed && participant.guess !== undefined ? (
                <span>{participant.guess}</span>
              ) : (
                <span className="text-[calc(0.875rem*var(--display-text-scale,1))] font-extrabold text-foreground/45">
                  {isRevealed
                    ? 'no guess'
                    : participant.hasGuessed
                      ? 'Answered'
                      : 'waiting…'}
                </span>
              )}
              {isWinner && (
                <span aria-hidden="true" className="text-green">
                  ✓
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {showAnswer && (
        <p className="font-display text-[calc(1.125rem*var(--display-text-scale,1))] text-green">
          <span className="font-body text-[calc(0.875rem*var(--display-text-scale,1))] font-extrabold text-foreground/55">
            ANSWER{' '}
          </span>
          {activeShowdown.answer}
        </p>
      )}
      {showAnswer && activeShowdown.isTie === true && (
        <p className="font-display text-[calc(1.5rem*var(--display-text-scale,1))] text-magenta">
          It&apos;s a tie — sudden death!
        </p>
      )}
    </>
  );
}
