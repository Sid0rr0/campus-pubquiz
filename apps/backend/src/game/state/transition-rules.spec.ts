import type { GameAction, GameStatus } from '@campus-pubquiz/types';
import { transitionFacts } from '@/game/state/transition-rules';

const STATUSES: GameStatus[] = [
  'lobby',
  'rules',
  'round_overview',
  'joker_pick',
  'round_intro',
  'question_open',
  'locking',
  'break_intro',
  'break',
  'break_round_intro',
  'answers_intro',
  'answers',
  'reveal_intro',
  'reveal',
  'ended',
];
const PRESSES: GameAction[] = [
  'START_QUIZ',
  'ADVANCE',
  'PREVIOUS',
  'END_QUIZ',
  'TOGGLE_LEADERBOARD',
];

const GRADED = [
  'break_intro',
  'break',
  'break_round_intro',
  'reveal_intro',
  'reveal',
  'ended',
];
const REVEALING = ['answers_intro', 'answers', 'reveal_intro', 'reveal'];

function facts(
  from: GameStatus,
  to: GameStatus,
  press: GameAction,
  { quickfire = false, versus = false } = {},
) {
  return transitionFacts(
    {
      progress: { status: from, roundIndex: 0 },
      seededGame: {
        settings: { versusEnabled: versus },
        rounds: [{ quickfire }],
      },
    },
    { status: to },
    press,
  );
}

describe('transitionFacts', () => {
  const cases = STATUSES.flatMap((from) =>
    STATUSES.flatMap((to) =>
      PRESSES.flatMap((press) =>
        [false, true].flatMap((quickfire) =>
          [false, true].map((versus) => ({
            from,
            to,
            press,
            quickfire,
            versus,
          })),
        ),
      ),
    ),
  );

  it.each(cases)(
    '$from -> $to on $press (quickfire $quickfire, versus $versus)',
    ({ from, to, press, quickfire, versus }) => {
      const leavesBreak =
        (from === 'break_intro' || from === 'break') &&
        !['break_intro', 'break', 'break_round_intro'].includes(to);
      expect(facts(from, to, press, { quickfire, versus })).toEqual({
        jokerPickCloses: from === 'joker_pick' && to !== 'joker_pick',
        jokerPickReopens: from !== 'joker_pick' && to === 'joker_pick',
        leavesLobby: from === 'lobby' && to !== 'lobby',
        startNeedsEverySide:
          press === 'START_QUIZ' && from === 'lobby' && versus,
        leavingBreakNeedsBlockGraded: press === 'ADVANCE' && leavesBreak,
        quickfireQuestionSpeedScored:
          quickfire && from === 'locking' && to !== 'locking',
        blockIsGraded: GRADED.includes(to) || REVEALING.includes(to),
        gradesBecomeVisible:
          (to === 'reveal_intro' && from !== 'reveal_intro') ||
          (from === 'locking' && to === 'reveal') ||
          (leavesBreak && !REVEALING.includes(to)),
        leavesBreakIntoResults: leavesBreak && to !== 'reveal_intro',
        leagueTablesMayChange: (from === 'ended') !== (to === 'ended'),
      });
    },
  );

  it('does not need the block graded for Previous or End quiz out of a break', () => {
    expect(
      facts('break', 'question_open', 'PREVIOUS').leavingBreakNeedsBlockGraded,
    ).toBe(false);
    expect(
      facts('break', 'ended', 'END_QUIZ').leavingBreakNeedsBlockGraded,
    ).toBe(false);
    expect(
      facts('break', 'reveal_intro', 'ADVANCE').leavingBreakNeedsBlockGraded,
    ).toBe(true);
  });

  it('does not need sides for End quiz in the lobby with Versus on', () => {
    expect(
      facts('lobby', 'ended', 'END_QUIZ', { versus: true }).startNeedsEverySide,
    ).toBe(false);
    expect(
      facts('lobby', 'rules', 'START_QUIZ', { versus: true })
        .startNeedsEverySide,
    ).toBe(true);
  });

  it('makes grades visible at exactly the three reveal moments', () => {
    expect(facts('break', 'reveal_intro', 'ADVANCE').gradesBecomeVisible).toBe(
      true,
    );
    expect(
      facts('locking', 'reveal', 'ADVANCE', { quickfire: true })
        .gradesBecomeVisible,
    ).toBe(true);
    expect(facts('break', 'round_intro', 'ADVANCE').gradesBecomeVisible).toBe(
      true,
    );
    expect(
      facts('break', 'break_round_intro', 'ADVANCE').gradesBecomeVisible,
    ).toBe(false);
    expect(facts('reveal_intro', 'reveal', 'ADVANCE').gradesBecomeVisible).toBe(
      false,
    );
  });
});
