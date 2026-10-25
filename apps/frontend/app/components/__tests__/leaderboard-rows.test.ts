import { describe, expect, it } from 'vitest';
import type { LeaderboardBoard, LeaderboardEntry } from '@campus-pubquiz/types';
import {
  selectLeaderboardRows,
  type LeaderboardRow,
  type LeaderboardRowsInput,
} from '@/app/components/leaderboard-rows';

// Which teams are shown, which basis the trends use and what the cap is are
// decided by the server (see the backend specs). These cases cover only what
// the rows module does with a description: the animation phases, the reveal
// walk and when the sent trends show.

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

/** A description as sent: settled entries, no count-up board and no trends unless given. */
function described(
  entries: LeaderboardEntry[],
  extra: Partial<LeaderboardBoard> = {},
): LeaderboardBoard {
  return { entries, trends: {}, ...extra };
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
          board: described(THREE_TEAMS),
          revealCount,
          phase: 'settled',
        });

        expect(board(rows)).toEqual(expected);
      },
    );

    it('gives tied teams one shared label', () => {
      const rows = selectLeaderboardRows({
        board: described([
          ranked(1, 'Leader', 30, 1),
          ranked(2, 'Tied A', 20, 2, 4),
          ranked(3, 'Tied B', 20, 2, 4),
          ranked(4, 'Tied C', 20, 2, 4),
          ranked(5, 'Last', 5, 5),
        ]),
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
        board: described([
          ranked(1, 'Leader', 30, 1),
          ranked(2, 'Tied A', 20, 2, 3),
          ranked(3, 'Tied B', 20, 2, 3),
        ]),
        revealCount: 1,
        phase: 'settled',
      });

      expect(board(rows)).toEqual(['Tied A 2.–3. 20', 'Tied B 2.–3. 20']);
    });

    it('reveals a tie at the top in one step', () => {
      const rows = selectLeaderboardRows({
        board: described([
          ranked(1, 'Tied A', 30, 1, 3),
          ranked(2, 'Tied B', 30, 1, 3),
          ranked(3, 'Tied C', 30, 1, 3),
        ]),
        revealCount: 1,
        phase: 'settled',
      });

      expect(board(rows)).toEqual([
        'Tied A 1.–3. 30',
        'Tied B 1.–3. 30',
        'Tied C 1.–3. 30',
      ]);
    });

    it('keeps every group when a tie sits below two clear places', () => {
      const rows = selectLeaderboardRows({
        board: described([
          ranked(1, 'First', 30, 1),
          ranked(2, 'Second', 20, 2),
          ranked(3, 'Tied A', 10, 3, 4),
          ranked(4, 'Tied B', 10, 3, 4),
        ]),
        revealCount: 3,
        phase: 'settled',
      });

      expect(board(rows)).toEqual([
        'First 1. 30',
        'Second 2. 20',
        'Tied A 3.–4. 10',
        'Tied B 3.–4. 10',
      ]);
    });

    it('reaches rank 1 once revealCount covers a capped board that splits a tie', () => {
      const cappedAtTie = [
        ranked(1, 'Team 1', 70, 1),
        ranked(2, 'Team 2', 60, 2),
        ranked(3, 'Team 3', 50, 3),
        ranked(4, 'Team 4', 40, 4),
        ranked(5, 'Team 5', 30, 5, 6),
      ];

      const rows = selectLeaderboardRows({
        board: described(cappedAtTie),
        revealCount: 5,
        phase: 'settled',
      });

      expect(board(rows)).toHaveLength(5);
      expect(board(rows)[0]).toBe('Team 1 1. 70');
    });
  });

  describe('count-up board animation', () => {
    const OLD = [ranked(2, 'Runner Up', 15, 1), ranked(1, 'Challenger', 10, 2)];
    // Challenger scored big and overtakes Runner Up, who scored nothing.
    const NEW = [ranked(1, 'Challenger', 40, 1), ranked(2, 'Runner Up', 15, 2)];
    const WITH_COUNT_UP = described(NEW, { countUpBoard: OLD });

    it.each<[LeaderboardRowsInput['phase'], string[]]>([
      ['old', ['Runner Up 1. 15', 'Challenger 2. 10']],
      ['counting', ['Runner Up 1. 15', 'Challenger 2. 40']],
      ['settled', ['Challenger 1. 40', 'Runner Up 2. 15']],
    ])(
      'draws the %s phase from the right board in the right order',
      (phase, expected) => {
        const rows = selectLeaderboardRows({ board: WITH_COUNT_UP, phase });

        expect(board(rows)).toEqual(expected);
      },
    );

    it.each<LeaderboardRowsInput['phase']>(['old', 'counting'])(
      'places each row by its old rank in the %s phase',
      (phase) => {
        const rows = selectLeaderboardRows({ board: WITH_COUNT_UP, phase });

        expect(rows.map(({ rankIndex }) => rankIndex)).toEqual([0, 1]);
      },
    );

    it('ignores revealCount while the old board is animating', () => {
      const rows = selectLeaderboardRows({
        board: WITH_COUNT_UP,
        revealCount: 1,
        phase: 'old',
      });

      expect(board(rows)).toEqual(['Runner Up 1. 15', 'Challenger 2. 10']);
    });

    it('draws a board without a count-up board settled whatever the phase', () => {
      const rows = selectLeaderboardRows({
        board: described(NEW),
        phase: 'old',
      });

      expect(board(rows)).toEqual(['Challenger 1. 40', 'Runner Up 2. 15']);
    });
  });

  describe('trends', () => {
    const OLD = [ranked(2, 'Runner Up', 15, 1), ranked(1, 'Challenger', 10, 2)];
    const NEW = [ranked(1, 'Challenger', 40, 1), ranked(2, 'Runner Up', 15, 2)];
    const SENT = described(NEW, {
      countUpBoard: OLD,
      trends: { 1: 'up', 2: 'down' },
    });

    /** Each row as `name trend`, with `none` for a row that carries no trend. */
    function trends(rows: LeaderboardRow[]): string[] {
      return rows.map(
        ({ entry, trend }) => `${entry.teamName} ${trend ?? 'none'}`,
      );
    }

    it('shows the trends exactly as sent once settled', () => {
      const rows = selectLeaderboardRows({ board: SENT, phase: 'settled' });

      expect(trends(rows)).toEqual(['Challenger up', 'Runner Up down']);
    });

    it.each<LeaderboardRowsInput['phase']>(['old', 'counting'])(
      'shows no trend in the %s phase',
      (phase) => {
        const rows = selectLeaderboardRows({ board: SENT, phase });

        expect(trends(rows)).toEqual(['Runner Up none', 'Challenger none']);
      },
    );

    it('leaves the trend key off a row the description sent none for', () => {
      const [row] = selectLeaderboardRows({
        board: described([ranked(1, 'Solo', 5, 1)]),
        phase: 'settled',
      });

      expect(row).toStrictEqual({
        entry: ranked(1, 'Solo', 5, 1),
        rankIndex: 0,
        label: '1.',
        isJokerStamped: false,
      });
    });

    it('shows no trend for a team the description sent none for', () => {
      const rows = selectLeaderboardRows({
        board: described(NEW, { trends: { 1: 'same' } }),
        phase: 'settled',
      });

      expect(trends(rows)).toEqual(['Challenger same', 'Runner Up none']);
    });
  });
});
