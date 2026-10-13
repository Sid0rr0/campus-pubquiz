import { describe, expect, it } from 'vitest';
import type { LeaderboardEntry } from '@campus-pubquiz/types';
import {
  selectLeaderboardRows,
  type LeaderboardRow,
  type LeaderboardRowsInput,
} from '@/app/components/leaderboard-rows';

function ranked(
  teamId: number,
  teamName: string,
  totalPoints: number,
  rank: number,
  rankTo: number = rank,
): LeaderboardEntry {
  return {
    teamId,
    teamName,
    totalPoints,
    rank,
    rankTo,
    bonusPoints: 0,
    positiveBonusPoints: 0,
    negativeBonusPoints: 0,
    roundPoints: [],
  };
}

/** Each row as `name label total`, so a case reads as the board the room sees. */
function board(rows: LeaderboardRow[]): string[] {
  return rows.map(
    ({ entry, label }) => `${entry.teamName} ${label} ${entry.totalPoints}`,
  );
}

const THREE_TEAMS = [
  ranked(1, 'First', 30, 1),
  ranked(2, 'Second', 20, 2),
  ranked(3, 'Third', 10, 3),
];

describe('selectLeaderboardRows', () => {
  describe('reveal walk', () => {
    it.each([
      ['omitted', undefined, ['First 1. 30', 'Second 2. 20', 'Third 3. 10']],
      ['0', 0, []],
      ['1', 1, ['Third 3. 10']],
      ['2', 2, ['Second 2. 20', 'Third 3. 10']],
      [
        'over the rank count',
        99,
        ['First 1. 30', 'Second 2. 20', 'Third 3. 10'],
      ],
    ])(
      'reveals bottom-up with revealCount %s, labels relative to the full standings',
      (_name, revealCount, expected) => {
        const rows = selectLeaderboardRows({
          entries: THREE_TEAMS,
          revealCount,
          phase: 'settled',
        });

        expect(board(rows)).toEqual(expected);
      },
    );

    it('gives tied teams one shared label', () => {
      const rows = selectLeaderboardRows({
        entries: [
          ranked(1, 'Leader', 30, 1),
          ranked(2, 'Tied A', 20, 2, 4),
          ranked(3, 'Tied B', 20, 2, 4),
          ranked(4, 'Tied C', 20, 2, 4),
          ranked(5, 'Last', 5, 5),
        ],
        phase: 'settled',
      });

      expect(board(rows)).toEqual([
        'Leader 1. 30',
        'Tied A 2.–4. 20',
        'Tied B 2.–4. 20',
        'Tied C 2.–4. 20',
        'Last 5. 5',
      ]);
    });

    it('reveals a tie in one step', () => {
      const rows = selectLeaderboardRows({
        entries: [
          ranked(1, 'Leader', 30, 1),
          ranked(2, 'Tied A', 20, 2, 3),
          ranked(3, 'Tied B', 20, 2, 3),
        ],
        revealCount: 1,
        phase: 'settled',
      });

      expect(board(rows)).toEqual(['Tied A 2.–3. 20', 'Tied B 2.–3. 20']);
    });
  });

  describe('cap', () => {
    const TIE_AT_CUTOFF = [
      ranked(1, 'Leader', 30, 1),
      ranked(2, 'Tied A', 20, 2, 3),
      ranked(3, 'Tied B', 20, 2, 3),
      ranked(4, 'Last', 5, 4),
    ];
    // Teams 1-4 in clear ranks, 5 and 6 tied for 5th-6th, 7 last.
    const SEVEN_WITH_TIE = [
      ranked(1, 'Team 1', 70, 1),
      ranked(2, 'Team 2', 60, 2),
      ranked(3, 'Team 3', 50, 3),
      ranked(4, 'Team 4', 40, 4),
      ranked(5, 'Team 5', 30, 5, 6),
      ranked(6, 'Team 6', 30, 5, 6),
      ranked(7, 'Team 7', 10, 7),
    ];

    it.each<{
      name: string;
      entries: LeaderboardEntry[];
      maxRank?: number;
      revealCount?: number;
      expected: string[];
    }>([
      {
        name: 'keeps the first maxRank teams',
        entries: THREE_TEAMS,
        maxRank: 2,
        expected: ['First 1. 30', 'Second 2. 20'],
      },
      {
        name: 'shows every team when maxRank is omitted',
        entries: THREE_TEAMS,
        expected: ['First 1. 30', 'Second 2. 20', 'Third 3. 10'],
      },
      {
        name: 'splits a tie at the cutoff instead of growing past maxRank',
        entries: TIE_AT_CUTOFF,
        maxRank: 2,
        expected: ['Leader 1. 30', 'Tied A 2.–3. 20'],
      },
      {
        name: 'walks the reveal up from the worst rank inside the capped pool',
        entries: THREE_TEAMS,
        maxRank: 2,
        revealCount: 1,
        expected: ['Second 2. 20'],
      },
      {
        name: 'reaches rank 1 once revealCount covers the capped pool',
        entries: SEVEN_WITH_TIE,
        maxRank: 5,
        revealCount: 5,
        expected: [
          'Team 1 1. 70',
          'Team 2 2. 60',
          'Team 3 3. 50',
          'Team 4 4. 40',
          'Team 5 5.–6. 30',
        ],
      },
    ])('$name', ({ entries, maxRank, revealCount, expected }) => {
      const rows = selectLeaderboardRows({
        entries,
        maxRank,
        revealCount,
        phase: 'settled',
      });

      expect(board(rows)).toEqual(expected);
    });
  });

  describe('old-board animation', () => {
    const OLD = [ranked(2, 'Runner Up', 15, 1), ranked(1, 'Challenger', 10, 2)];
    // Challenger scored big and overtakes Runner Up, who scored nothing.
    const NEW = [ranked(1, 'Challenger', 40, 1), ranked(2, 'Runner Up', 15, 2)];

    it.each<[LeaderboardRowsInput['phase'], string[]]>([
      ['old', ['Runner Up 1. 15', 'Challenger 2. 10']],
      ['counting', ['Runner Up 1. 15', 'Challenger 2. 40']],
      ['settled', ['Challenger 1. 40', 'Runner Up 2. 15']],
    ])(
      'draws the %s phase from the right board in the right order',
      (phase, expected) => {
        const rows = selectLeaderboardRows({
          entries: NEW,
          previousEntries: OLD,
          phase,
        });

        expect(board(rows)).toEqual(expected);
      },
    );

    it('ignores revealCount while the old board is animating', () => {
      const rows = selectLeaderboardRows({
        entries: NEW,
        previousEntries: OLD,
        revealCount: 1,
        phase: 'old',
      });

      expect(board(rows)).toEqual(['Runner Up 1. 15', 'Challenger 2. 10']);
    });

    it('starts a team new to the board at 0', () => {
      const rows = selectLeaderboardRows({
        entries: [...NEW, ranked(3, 'Newcomer', 5, 3)],
        previousEntries: OLD,
        phase: 'old',
      });

      expect(board(rows)).toEqual([
        'Runner Up 1. 15',
        'Challenger 2. 10',
        'Newcomer 3. 0',
      ]);
    });

    it('stands an empty previous board in as every team at 0, capped to the eventual top teams', () => {
      const sevenTeams = Array.from({ length: 7 }, (_, index) =>
        ranked(index + 1, `Team ${index + 1}`, 7 - index, index + 1),
      );

      const rows = selectLeaderboardRows({
        entries: sevenTeams,
        previousEntries: [],
        revealCount: 5,
        maxRank: 5,
        phase: 'old',
      });

      expect(board(rows)).toEqual([
        'Team 1 1.–5. 0',
        'Team 2 1.–5. 0',
        'Team 3 1.–5. 0',
        'Team 4 1.–5. 0',
        'Team 5 1.–5. 0',
      ]);
    });

    it('picks the old pool by final standing when the old board had no ties', () => {
      // Before: 8 distinct scores. After: A and B pull ahead, the other six
      // all collapse to 0. The pool must be the final board's first 5.
      const oldBoard = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(
        (name, index) =>
          ranked(
            index + 1,
            `Team ${name}`,
            [50, 40, 30, 20, 10, 9, 8, 7][index],
            index + 1,
          ),
      );
      const newBoard = [
        ranked(1, 'Team A', 100, 1),
        ranked(2, 'Team B', 90, 2),
        ...[3, 4, 5, 6, 7, 8].map((teamId) =>
          ranked(teamId, oldBoard[teamId - 1].teamName, 0, 3, 8),
        ),
      ];

      const rows = selectLeaderboardRows({
        entries: newBoard,
        previousEntries: oldBoard,
        revealCount: 5,
        maxRank: 5,
        phase: 'old',
      });

      expect(board(rows)).toEqual([
        'Team A 1. 50',
        'Team B 2. 40',
        'Team C 3. 30',
        'Team D 4. 20',
        'Team E 5. 10',
      ]);
    });
  });
});

/** An entry with its points for round 0, for the "round backed out" basis. */
function withRound(entry: LeaderboardEntry, points?: number): LeaderboardEntry {
  return {
    ...entry,
    roundPoints:
      points === undefined ? [] : [{ roundTitle: 'Round 1', points }],
  };
}

/** Each row as `name trend`, with `none` for a row that carries no trend. */
function trends(rows: LeaderboardRow[]): string[] {
  return rows.map(({ entry, trend }) => `${entry.teamName} ${trend ?? 'none'}`);
}

describe('selectLeaderboardRows trend', () => {
  it('gives no trend without a basis', () => {
    const rows = selectLeaderboardRows({
      entries: THREE_TEAMS,
      phase: 'settled',
    });

    expect(trends(rows)).toEqual(['First none', 'Second none', 'Third none']);
  });

  it.each<{ name: string; entries: LeaderboardEntry[]; expected: string[] }>([
    {
      // Overtaker trailed 10 to 20 before the round, scored 15 to Leader's 0.
      name: 'up and down for an overtake',
      entries: [
        withRound(ranked(1, 'Overtaker', 25, 1), 15),
        withRound(ranked(2, 'Leader', 20, 2), 0),
      ],
      expected: ['Overtaker up', 'Leader down'],
    },
    {
      name: 'same for teams that keep their rank',
      entries: [
        withRound(ranked(1, 'Steady Leader', 30, 1), 10),
        withRound(ranked(2, 'Steady Second', 20, 2), 5),
      ],
      expected: ['Steady Leader same', 'Steady Second same'],
    },
    {
      // Both on 0 before the round: Scorer stays top, No Data drops to 2nd.
      name: 'a team with no points recorded for the round as scoring 0',
      entries: [
        withRound(ranked(1, 'Only Scorer', 10, 1), 10),
        withRound(ranked(2, 'No Data', 0, 2)),
      ],
      expected: ['Only Scorer same', 'No Data down'],
    },
    {
      // Alpha and Bravo tied on 30, Climber on 10; Climber +15, Bravo -10.
      name: 'up for a team that overtakes a fallen tied leader',
      entries: [
        withRound(ranked(1, 'Alpha', 30, 1), 0),
        withRound(ranked(3, 'Climber', 25, 2), 15),
        withRound(ranked(2, 'Bravo', 20, 3), -10),
      ],
      expected: ['Alpha same', 'Climber up', 'Bravo down'],
    },
  ])(
    'compares against this round backed out: $name',
    ({ entries, expected }) => {
      const rows = selectLeaderboardRows({
        entries,
        currentRoundIndex: 0,
        phase: 'settled',
      });

      expect(trends(rows)).toEqual(expected);
    },
  );

  it.each<{
    name: string;
    entries: LeaderboardEntry[];
    trendBaseline: LeaderboardEntry[];
    expected: string[];
  }>([
    {
      name: 'same for teams that stay tied',
      entries: [
        ranked(1, 'Leader', 30, 1),
        ranked(2, 'Amy', 20, 2, 3),
        ranked(3, 'Zed', 20, 2, 3),
      ],
      trendBaseline: [
        ranked(1, 'Leader', 25, 1),
        ranked(2, 'Amy', 15, 2, 3),
        ranked(3, 'Zed', 15, 2, 3),
      ],
      expected: ['Leader same', 'Amy same', 'Zed same'],
    },
    {
      name: 'up for the team that pulled level, same for the one it caught',
      entries: [
        ranked(1, 'Leader', 30, 1),
        ranked(2, 'Amy', 20, 2, 3),
        ranked(3, 'Zed', 20, 2, 3),
      ],
      trendBaseline: [
        ranked(1, 'Leader', 30, 1),
        ranked(2, 'Amy', 20, 2),
        ranked(3, 'Zed', 10, 3),
      ],
      expected: ['Leader same', 'Amy same', 'Zed up'],
    },
    {
      name: 'a split tie: the team that pulled ahead stays, the other drops',
      entries: [
        ranked(1, 'Leader', 30, 1),
        ranked(3, 'Zed', 25, 2),
        ranked(2, 'Amy', 20, 3),
      ],
      trendBaseline: [
        ranked(1, 'Leader', 30, 1),
        ranked(2, 'Amy', 20, 2, 3),
        ranked(3, 'Zed', 20, 2, 3),
      ],
      expected: ['Leader same', 'Zed same', 'Amy down'],
    },
  ])(
    'compares ties against the trend baseline: $name',
    ({ entries, trendBaseline, expected }) => {
      const rows = selectLeaderboardRows({
        entries,
        trendBaseline,
        phase: 'settled',
      });

      expect(trends(rows)).toEqual(expected);
    },
  );

  it('prefers the trend baseline over the round backed out', () => {
    // A Kahoot round holding every point so far: backing the round out
    // would tie everyone on 0. The baseline is the board before the last
    // question, so Second overtaking First reads as a real swap.
    const entries = [
      withRound(ranked(2, 'Second', 40, 1), 40),
      withRound(ranked(1, 'First', 30, 2), 30),
      withRound(ranked(3, 'Third', 10, 3), 10),
    ];
    const trendBaseline = [
      ranked(1, 'First', 30, 1),
      ranked(2, 'Second', 20, 2),
      ranked(3, 'Third', 10, 3),
    ];

    const rows = selectLeaderboardRows({
      entries,
      trendBaseline,
      currentRoundIndex: 0,
      phase: 'settled',
    });

    expect(trends(rows)).toEqual(['Second up', 'First down', 'Third same']);
  });

  it('prefers the previous entries over the trend baseline and the round', () => {
    const entries = [
      withRound(ranked(2, 'Second', 40, 1), 40),
      withRound(ranked(1, 'First', 30, 2), 30),
    ];
    const previousEntries = [
      ranked(1, 'First', 30, 1),
      ranked(2, 'Second', 20, 2),
    ];
    // The opposite order, so following it would give the opposite arrows.
    const trendBaseline = [
      ranked(2, 'Second', 30, 1),
      ranked(1, 'First', 20, 2),
    ];

    const rows = selectLeaderboardRows({
      entries,
      previousEntries,
      trendBaseline,
      currentRoundIndex: 0,
      phase: 'settled',
    });

    expect(trends(rows)).toEqual(['Second up', 'First down']);
  });

  describe('forced up on an all-tied old board', () => {
    const NEW = [
      ranked(1, 'Alpha', 30, 1),
      ranked(2, 'Bravo', 10, 2),
      ranked(3, 'Charlie', 0, 3),
    ];

    it('gives every team up when every team was tied beforehand', () => {
      const rows = selectLeaderboardRows({
        entries: NEW,
        previousEntries: [
          ranked(1, 'Alpha', 0, 1, 3),
          ranked(2, 'Bravo', 0, 1, 3),
          ranked(3, 'Charlie', 0, 1, 3),
        ],
        currentRoundIndex: 0,
        phase: 'settled',
      });

      expect(trends(rows)).toEqual(['Alpha up', 'Bravo up', 'Charlie up']);
    });

    it.each<[string, Partial<LeaderboardRowsInput>]>([
      ['previous entries', { previousEntries: [] }],
      ['trend baseline', { trendBaseline: [] }],
    ])(
      'gives every team up on the first-ever Kahoot board (empty %s)',
      (_name, basis) => {
        const rows = selectLeaderboardRows({
          entries: NEW,
          ...basis,
          phase: 'settled',
        });

        expect(trends(rows)).toEqual(['Alpha up', 'Bravo up', 'Charlie up']);
      },
    );
  });

  it.each<LeaderboardRowsInput['phase']>(['old', 'counting'])(
    'gives no trend in the %s phase',
    (phase) => {
      const rows = selectLeaderboardRows({
        entries: [
          ranked(1, 'Challenger', 40, 1),
          ranked(2, 'Runner Up', 15, 2),
        ],
        previousEntries: [
          ranked(2, 'Runner Up', 15, 1),
          ranked(1, 'Challenger', 10, 2),
        ],
        currentRoundIndex: 0,
        phase,
      });

      expect(trends(rows)).toEqual(['Runner Up none', 'Challenger none']);
    },
  );
});
