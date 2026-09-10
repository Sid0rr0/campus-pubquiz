import type { GameStatus } from '@campus-pubquiz/types';

interface AdvanceGatingInput {
  gameStatus: GameStatus | undefined;
  hasActiveShowdown: boolean;
  showdownRevealStep: number;
  revealIndex: number;
  activeBlockStartIndex: number;
  previousStatus: GameStatus | null | undefined;
}

interface AdvanceGatingResult {
  canAdvance: boolean;
  canGoToPreviousQuestion: boolean;
}

/**
 * Whether Advance/Previous are legal for the current game status — shared by
 * /control (via NavigationButtons/MobileAdminBar) and /remote, since a
 * presenter driving the quiz from their phone needs the exact same gating
 * the admin console uses.
 */
export function getAdvanceGating({
  gameStatus,
  hasActiveShowdown,
  showdownRevealStep,
  revealIndex,
  activeBlockStartIndex,
  previousStatus,
}: AdvanceGatingInput): AdvanceGatingResult {
  const canAdvance =
    gameStatus === 'rules' ||
    gameStatus === 'round_intro' ||
    gameStatus === 'question_open' ||
    gameStatus === 'locking' ||
    gameStatus === 'break_intro' ||
    gameStatus === 'break' ||
    gameStatus === 'break_round_intro' ||
    gameStatus === 'reveal_intro' ||
    gameStatus === 'reveal' ||
    (gameStatus === 'ended' && hasActiveShowdown);
  const canGoToPreviousQuestion =
    gameStatus === 'round_intro' ||
    gameStatus === 'question_open' ||
    gameStatus === 'locking' ||
    // 'reveal', 'reveal_intro', 'break', and 'break_intro' always have
    // somewhere to go back to — 'break_intro' reveals the just-locked
    // question, 'break' now always pauses on a round's own title card
    // (break_round_intro) before ever needing to cross a block boundary, and
    // 'reveal_intro' just re-enters that same block's break, always legal on
    // its own. Only 'break_round_intro' can hit the true start of the quiz's
    // reveal history (walking a title card backward past the block's first
    // question, with no earlier block to cross into), where Previous has
    // nothing left to do.
    gameStatus === 'reveal' ||
    gameStatus === 'reveal_intro' ||
    gameStatus === 'break_intro' ||
    gameStatus === 'break' ||
    (gameStatus === 'break_round_intro' &&
      (revealIndex > 0 || activeBlockStartIndex > 0)) ||
    // Once the quiz has ended, Previous undoes back into whatever status
    // was active right before — hidden for legacy sessions that reached
    // 'ended' with no recorded previousStatus.
    (gameStatus === 'ended' && previousStatus != null) ||
    // Steps back through an active showdown's own reveal walk — a no-op at
    // step 0 (see tryStepShowdownReveal), so only shown once there's
    // somewhere to go.
    (gameStatus === 'ended' && hasActiveShowdown && showdownRevealStep > 0);

  return { canAdvance, canGoToPreviousQuestion };
}
