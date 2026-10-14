import { motion, useReducedMotion } from 'motion/react';
import type { ActiveShowdownView } from '@campus-pubquiz/types';

/** A ring that swells out of the winner's row and fades. Under reduced motion it is a plain fade-out, nothing moves. */
function WinnerBurst({ isReducedMotion }: { isReducedMotion: boolean }) {
  return (
    <motion.span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 rounded-xl border-4 border-green"
      initial={{ opacity: 0.9, scale: 1 }}
      animate={isReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 1.35 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
    />
  );
}

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
  const isReducedMotion = useReducedMotion() === true;
  // The seat whose guess was just revealed is "up"; once the answer is on
  // screen the winner takes the spotlight instead.
  const spotlitSeatIndex = showAnswer ? null : step - 1;
  // Motion is transform/opacity only; reduced motion keeps just the fade.
  const slamIn = isReducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
    : {
        initial: { opacity: 0, scale: 1.8 },
        animate: { opacity: 1, scale: 1 },
        transition: { type: 'spring' as const, stiffness: 500, damping: 20 },
      };

  return (
    <>
      <p className="text-display-sm font-extrabold tracking-wide text-foreground/55">
        SHOWDOWN TIEBREAKER
      </p>
      <h1 className="text-balance font-display text-display-4xl leading-snug">
        {question}
      </h1>
      <ul className="flex w-full max-w-xl flex-col gap-3 text-left">
        {participants.map((participant) => {
          const isRevealed = step >= participant.seatIndex + 1;
          const isWinner =
            showAnswer && activeShowdown.winnerTeamId === participant.teamId;
          const isSpotlit = participant.seatIndex === spotlitSeatIndex;
          return (
            <li
              key={participant.teamId}
              data-spotlight={isSpotlit}
              className={`relative flex items-center justify-between gap-3 rounded-xl border-2 bg-white px-5 py-3 text-display-xl font-bold text-foreground transition-transform ${
                isWinner
                  ? 'border-green'
                  : isSpotlit
                    ? 'border-magenta'
                    : 'border-foreground/20'
              } ${isSpotlit && !isReducedMotion ? 'scale-105' : ''}`}
            >
              {isWinner && <WinnerBurst isReducedMotion={isReducedMotion} />}
              <span>{participant.teamName}</span>
              {isRevealed && participant.guess !== undefined ? (
                <motion.span {...slamIn}>{participant.guess}</motion.span>
              ) : (
                <span className="text-display-sm font-extrabold text-foreground/45">
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
        <p className="font-display text-display-lg text-green">
          <span className="font-body text-display-sm font-extrabold text-foreground/55">
            ANSWER{' '}
          </span>
          {activeShowdown.answer}
        </p>
      )}
      {showAnswer && activeShowdown.isTie === true && (
        <p className="font-display text-display-2xl text-magenta">
          It&apos;s a tie — sudden death!
        </p>
      )}
    </>
  );
}
