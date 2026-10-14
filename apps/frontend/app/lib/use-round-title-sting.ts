'use client';

import type { GameStatus, OnAirScreen } from '@campus-pubquiz/types';
import { displaySounds } from '@/app/lib/display-sounds';
import { useOnLiveForwardMove } from '@/app/lib/live-change';

export interface RoundTitleStingFrame {
  status: GameStatus;
  roundIndex: number;
  screenKind: OnAirScreen['kind'];
}

const BEFORE_FIRST_ROUND = -1;
const AFTER_LAST_ROUND = Number.MAX_SAFE_INTEGER;
const STEPS_PER_ROUND = 4;

/** Phase inside a round: intro, then the question block, then break/reveal. */
function getRoundPhase(status: GameStatus): number {
  switch (status) {
    case 'round_intro':
      return 0;
    case 'question_open':
    case 'locking':
      return 1;
    default:
      return 2;
  }
}

/** A number that only grows as the quiz moves forward through the rounds. */
function getQuizPosition({ status, roundIndex }: RoundTitleStingFrame): number {
  switch (status) {
    case 'lobby':
    case 'rules':
    case 'round_overview':
      return BEFORE_FIRST_ROUND;
    case 'ended':
      return AFTER_LAST_ROUND;
    default:
      return roundIndex * STEPS_PER_ROUND + getRoundPhase(status);
  }
}

/**
 * Plays the round sting on the big screen when the quiz moves forward onto
 * the round intro card. Not for the break round intro or the reveal intro
 * (they repeat back to back), and never on load, reconnect or Previous.
 */
export function useRoundTitleSting(
  frame: RoundTitleStingFrame | null,
  isConnected: boolean,
): void {
  useOnLiveForwardMove(
    frame ? getQuizPosition(frame) : BEFORE_FIRST_ROUND,
    isConnected && frame !== null,
    () => {
      if (frame?.screenKind === 'round_title') {
        displaySounds.play('sting');
      }
    },
  );
}
