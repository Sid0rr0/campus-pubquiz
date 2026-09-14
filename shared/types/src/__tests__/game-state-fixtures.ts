import type { GameContext, GameProgress } from '../game-state';

export const twoRoundsWithBreakAfterSecond: GameContext = {
  rounds: [
    { questionCount: 2, breakAfter: false },
    { questionCount: 2, breakAfter: true },
  ],
};

/** A normal round followed by a 3-question kahootMode round — every question of round 1 is its own one-question block. */
export const kahootRoundAfterNormalRound: GameContext = {
  rounds: [
    { questionCount: 1, breakAfter: true },
    { questionCount: 3, breakAfter: false, kahootMode: true },
  ],
};

/** A 2-question kahootMode round followed by a normal round — for testing that finishing the kahoot round's last question moves on to the next round rather than ending the quiz. */
export const kahootRoundBeforeNormalRound: GameContext = {
  rounds: [
    { questionCount: 2, breakAfter: false, kahootMode: true },
    { questionCount: 1, breakAfter: true },
  ],
};

export const lobby: GameProgress = {
  status: 'lobby',
  roundIndex: 0,
  questionIndex: 0,
  isLeaderboardVisible: false,
  revealIndex: 0,
  furthestOpenIndex: 0,
};
