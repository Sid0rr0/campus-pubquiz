import {
  getBlockInPlay,
  getBlockInPlayIds,
  getPastBlockIds,
  type GameProgress,
  type GameStatus,
} from '@campus-pubquiz/types';
import {
  BLOCK_IN_PLAY_ROUNDS,
  questionId,
} from '@/game/__tests__/block-in-play-quiz';

function progress(
  status: GameStatus,
  roundIndex: number,
  questionIndex: number,
  furthestOpenIndex: number,
  overrides: Partial<GameProgress> = {},
): GameProgress {
  return {
    status,
    roundIndex,
    questionIndex,
    isLeaderboardVisible: false,
    revealIndex: 0,
    furthestOpenIndex,
    ...overrides,
  };
}

const q = questionId;
const FIRST_BLOCK = [q(0, 0), q(0, 1), q(1, 0), q(1, 1)];

describe('getBlockInPlayIds', () => {
  const cases: [string, GameProgress, number[]][] = [
    // Statuses before any block exists
    ['lobby', progress('lobby', 0, 0, -1), []],
    ['rules', progress('rules', 0, 0, -1), []],
    ['round overview', progress('round_overview', 0, 0, -1), []],

    // Answering: up to the furthest opened question
    [
      'a fresh round intro with nothing opened',
      progress('round_intro', 0, 0, -1),
      [],
    ],
    ['the first question open', progress('question_open', 0, 0, 0), [q(0, 0)]],
    [
      'the second question open',
      progress('question_open', 0, 1, 1),
      [q(0, 0), q(0, 1)],
    ],
    ['the first block locking', progress('locking', 1, 1, 3), FIRST_BLOCK],
    [
      "a round intro reached by Advance into the block's second round",
      progress('round_intro', 1, 0, 1),
      [q(0, 0), q(0, 1)],
    ],
    [
      "a round intro reached by Previous from the block's second round",
      progress('round_intro', 1, 0, 2),
      [q(0, 0), q(0, 1), q(1, 0)],
    ],
    [
      'Previous stepping back inside the open block keeps the furthest opened question',
      progress('question_open', 0, 1, 2),
      [q(0, 0), q(0, 1), q(1, 0)],
    ],
    [
      'a fresh second block with nothing opened',
      progress('round_intro', 2, 0, -1),
      [],
    ],
    [
      "the second block's first question",
      progress('question_open', 2, 0, 0),
      [q(2, 0)],
    ],

    // Once locked: the whole block
    ['break intro', progress('break_intro', 1, 1, 3), FIRST_BLOCK],
    ['break', progress('break', 1, 1, 3), FIRST_BLOCK],
    ['break round intro', progress('break_round_intro', 1, 1, 3), FIRST_BLOCK],
    ['reveal intro', progress('reveal_intro', 1, 1, 3), FIRST_BLOCK],
    ['reveal', progress('reveal', 1, 1, 3, { revealIndex: 2 }), FIRST_BLOCK],
    [
      'the second block at its break',
      progress('break', 2, 1, 1),
      [q(2, 0), q(2, 1)],
    ],

    // Kahoot: every question is its own block
    ['a kahoot question open', progress('question_open', 3, 1, 0), [q(3, 1)]],
    ['a kahoot question revealed', progress('reveal', 3, 0, 0), [q(3, 0)]],

    // The final round
    [
      'the final round at reveal',
      progress('reveal', 4, 1, 1),
      [q(4, 0), q(4, 1)],
    ],

    // ended: the last block played, up to where progress stands
    [
      'ended after the reveal',
      progress('ended', 4, 1, 1, { previousStatus: 'reveal' }),
      [q(4, 0), q(4, 1)],
    ],
    [
      'ended pressed mid-block after Previous (stops at the question on screen, not the furthest opened)',
      progress('ended', 0, 1, 2, { previousStatus: 'question_open' }),
      [q(0, 0), q(0, 1)],
    ],
  ];

  it.each(cases)('is the right ids for %s', (_name, given, expected) => {
    expect(getBlockInPlayIds(BLOCK_IN_PLAY_ROUNDS, given)).toEqual(expected);
  });
});

describe('getBlockInPlay', () => {
  it('names each question by its round index, question index and id, in play order', () => {
    expect(
      getBlockInPlay(BLOCK_IN_PLAY_ROUNDS, progress('reveal', 1, 1, 3)),
    ).toEqual([
      { roundIndex: 0, questionIndex: 0, questionId: q(0, 0) },
      { roundIndex: 0, questionIndex: 1, questionId: q(0, 1) },
      { roundIndex: 1, questionIndex: 0, questionId: q(1, 0) },
      { roundIndex: 1, questionIndex: 1, questionId: q(1, 1) },
    ]);
  });
});

describe('getPastBlockIds', () => {
  const cases: [string, GameProgress, number[]][] = [
    [
      'the first block has nothing behind it',
      progress('question_open', 0, 1, 1),
      [],
    ],
    [
      'a round inside the first block has nothing behind it',
      progress('question_open', 1, 0, 2),
      [],
    ],
    [
      'the second block has the whole first block behind it',
      progress('question_open', 2, 0, 0),
      FIRST_BLOCK,
    ],
    [
      'a kahoot round at its first question has the earlier blocks behind it',
      progress('question_open', 3, 0, 0),
      [...FIRST_BLOCK, q(2, 0), q(2, 1)],
    ],
    [
      "a kahoot round's second question has its first question behind it too",
      progress('question_open', 3, 1, 0),
      [...FIRST_BLOCK, q(2, 0), q(2, 1), q(3, 0)],
    ],
    [
      'the final round has everything before it behind it',
      progress('question_open', 4, 0, 0),
      [...FIRST_BLOCK, q(2, 0), q(2, 1), q(3, 0), q(3, 1)],
    ],
  ];

  it.each(cases)('is the right ids when %s', (_name, given, expected) => {
    expect(getPastBlockIds(BLOCK_IN_PLAY_ROUNDS, given)).toEqual(expected);
  });
});
