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
