import { describe, expect, it } from 'vitest';
import type { GameProgress } from '../game-state';
import { getPostBreakBoardBlock } from '../post-break-board';
import { round, sessionWith } from './session-fixtures';

function withBoard(progress: Partial<GameProgress>, isEarly = true) {
  const session = sessionWith([round(1, [10, 11]), round(2, [20])], {
    status: 'round_intro',
    roundIndex: 1,
    questionIndex: 0,
    furthestOpenIndex: -1,
    isLeaderboardVisible: true,
    ...progress,
  });
  return {
    ...session,
    seededGame: {
      ...session.seededGame,
      settings: { ...session.seededGame.settings, earlyAnswerReveal: isEarly },
    },
  };
}

describe('getPostBreakBoardBlock', () => {
  it('stands on the last question of the block before a fresh round intro', () => {
    expect(getPostBreakBoardBlock(withBoard({}))).toMatchObject({
      status: 'reveal',
      roundIndex: 0,
      questionIndex: 1,
    });
  });

  it('stands on the final block after the quiz ended from its break', () => {
    expect(
      getPostBreakBoardBlock(
        withBoard({ status: 'ended', previousStatus: 'break_intro' }),
      ),
    ).toMatchObject({ status: 'reveal', roundIndex: 1 });
  });

  it('is null when the block before ended on a quickfire round, which has no break', () => {
    const session = sessionWith(
      [round(1, [10, 11], { quickfire: true }), round(2, [20])],
      {
        status: 'round_intro',
        roundIndex: 1,
        questionIndex: 0,
        furthestOpenIndex: -1,
        isLeaderboardVisible: true,
      },
    );
    expect(
      getPostBreakBoardBlock({
        ...session,
        seededGame: {
          ...session.seededGame,
          settings: { ...session.seededGame.settings, earlyAnswerReveal: true },
        },
      }),
    ).toBeNull();
  });

  it.each([
    ['with the setting off', withBoard({}, false)],
    ['with the board hidden', withBoard({ isLeaderboardVisible: false })],
    ['at the quiz start, with no block before', withBoard({ roundIndex: 0 })],
    [
      'once a question of the block has opened',
      withBoard({ furthestOpenIndex: 0 }),
    ],
    ['at a status that is no round intro', withBoard({ status: 'rules' })],
    [
      'after the quiz ended by End Quiz',
      withBoard({ status: 'ended', previousStatus: 'question_open' }),
    ],
    [
      'after the quiz ended with no recorded status',
      withBoard({ status: 'ended' }),
    ],
  ])('is null %s', (_name, session) => {
    expect(getPostBreakBoardBlock(session)).toBeNull();
  });
});
