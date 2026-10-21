import type { ActiveShowdownRoundState } from './session-state';
import type { ActiveShowdownView } from './showdown';
import type { SteppedRevealDescriptor } from './stepped-reveal';

/** The number of the showdown's final step: one per participant's guess, then the answer/winner. */
function getShowdownFinalStep(round: ActiveShowdownRoundState): number {
  return round.participants.length + 1;
}

/** Projects the server-only ActiveShowdownRoundState cache into the wire-facing ActiveShowdownView for a given reveal step — cumulative disclosure, mirrors summarizeClosestGuess/ClosestGuessRevealData's step gating. */
export function buildActiveShowdownView(
  round: ActiveShowdownRoundState | null,
  step: number,
): ActiveShowdownView | null {
  if (!round) return null;
  const finalStep = getShowdownFinalStep(round);
  const sortedParticipants = [...round.participants].sort(
    (a, b) => a.seatIndex - b.seatIndex,
  );
  return {
    id: round.id,
    question: round.question,
    participants: sortedParticipants.map((participant) => ({
      teamId: participant.teamId,
      teamName: participant.teamName,
      seatIndex: participant.seatIndex,
      hasGuessed: participant.guess !== null,
      ...(participant.guess !== null && step >= participant.seatIndex + 1
        ? { guess: participant.guess }
        : {}),
    })),
    ...(step >= finalStep
      ? {
          answer: round.answer,
          winnerTeamId: round.winnerTeamId,
          isTie: round.isTie,
        }
      : {}),
  };
}

/** The showdown as a stepped reveal: step 0 shows no guess, step N the first N seats' guesses, the last step the answer and winner. It holds at both ends, and the first Advance waits until every seat has guessed. */
export function showdownRevealDescriptor(
  round: ActiveShowdownRoundState,
): SteppedRevealDescriptor {
  return {
    stepCount: getShowdownFinalStep(round) + 1,
    atStart: 'hold',
    atEnd: 'hold',
    canStart: round.participants.every(
      (participant) => participant.guess !== null,
    ),
  };
}
