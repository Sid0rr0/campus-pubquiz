import type { ActiveShowdownView } from '@campus-pubquiz/types';
import { ShowdownGuessesPendingError } from '@/game/state/errors/showdown-guesses-pending.error';
import type {
  ActiveShowdownRoundState,
  SessionState,
} from '@/game/state/session-state';

/** How many reveal sub-steps an active showdown round has: one per participant's guess, plus one final step for the answer/winner. */
function getShowdownRevealStepCount(round: ActiveShowdownRoundState): number {
  return round.participants.length + 1;
}

/** Projects the server-only ActiveShowdownRoundState cache into the wire-facing ActiveShowdownView for a given reveal step — cumulative disclosure, mirrors summarizeClosestGuess/ClosestGuessRevealData's step gating. */
export function buildActiveShowdownView(
  round: ActiveShowdownRoundState | null,
  step: number,
): ActiveShowdownView | null {
  if (!round) return null;
  const finalStep = getShowdownRevealStepCount(round);
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

/** ADVANCE/PREVIOUS while a showdown round is active — mirrors tryStepClosestGuessReveal's shape, but signals the caller (GameStateService.applyAction) when crossing into the final step so it can trigger ShowdownService.resolve() and a leaderboard refresh. Never falls through to getNextGameState; status stays 'ended' throughout. */
export function tryStepShowdownReveal(
  session: SessionState,
  action: 'ADVANCE' | 'PREVIOUS',
): { session: SessionState; shouldResolve: boolean } | null {
  const round = session.activeShowdownRound;
  if (!round) return null;

  const finalStep = getShowdownRevealStepCount(round);
  const step = session.showdownRevealStep;

  if (action === 'PREVIOUS') {
    if (step === 0) return { session, shouldResolve: false };
    return {
      session: { ...session, showdownRevealStep: step - 1 },
      shouldResolve: false,
    };
  }

  // ADVANCE
  if (
    step === 0 &&
    round.participants.some((participant) => participant.guess === null)
  ) {
    throw new ShowdownGuessesPendingError();
  }
  if (step >= finalStep) {
    // Already fully revealed — a repeated ADVANCE press is a harmless no-op.
    return { session, shouldResolve: false };
  }
  const nextStep = step + 1;
  return {
    session: { ...session, showdownRevealStep: nextStep },
    shouldResolve: nextStep === finalStep,
  };
}
