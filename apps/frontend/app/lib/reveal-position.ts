import type { GameProgress } from '@campus-pubquiz/types';

const QUESTIONS_PER_ROUND_SPAN = 1_000;
const PHASES = 3;
const STEPS_PER_PHASE = 10_000;

type RevealPhase = 0 | 1 | 2;

/** 0: before the block's answers, 1: revealing them, 2: the quiz is over. */
function phaseOf({ status }: GameProgress): RevealPhase {
  if (status === 'ended') return 2;
  return status === 'reveal_intro' || status === 'reveal' ? 1 : 0;
}

/**
 * A number for the live-change helper that only grows as the quiz moves
 * forward through blocks, their reveals and the end, and falls on Previous.
 * A block's break and reveal keep the block's last round and question while
 * only `revealIndex` walks, so (round, question) orders blocks, the phase
 * orders a block's stages, and within the reveal each answer's intro card
 * comes just before the answer itself.
 */
export function revealPosition(progress: GameProgress): number {
  const phase = phaseOf(progress);
  const step =
    phase === 1
      ? progress.revealIndex * 2 + (progress.status === 'reveal' ? 1 : 0)
      : 0;
  const block =
    progress.roundIndex * QUESTIONS_PER_ROUND_SPAN + progress.questionIndex;
  return (block * PHASES + phase) * STEPS_PER_PHASE + step;
}
