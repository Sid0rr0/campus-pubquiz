import { describe, expect, it } from 'vitest';
import type { FunFactBonusAward } from '../fun-facts';
import { describeBlockBoards } from '../rank-callouts';
import { projectScreen } from '../screen-projection';
import { SOCKET_ROOMS } from '../socket-events';
import type { LeaderboardEntry } from '../room-views';
import type { SessionState } from '../session-state';
import { leaderboardEntry, round, sessionWith } from './session-fixtures';

// Block 1 is Music + Sport (questions 1-3), block 2 is Film (question 4), block 3 is Art (question 5, the final one).
const ROUNDS = [
  round(1, [1, 2], { breakAfter: false, title: 'Music' }),
  round(2, [3], { title: 'Sport' }),
  round(3, [4], { title: 'Film' }),
  round(4, [5], { title: 'Art' }),
];

function team(id: number, name: string, points: number[]): LeaderboardEntry {
  const entry = leaderboardEntry(id, name, 0);
  return {
    ...entry,
    totalPoints: points.reduce((a, b) => a + b, 0),
    roundPoints: points.map((p, i) => ({
      roundTitle: ROUNDS[i].title,
      points: p,
    })),
  };
}

const award = (
  teamId: number,
  points: number,
  blockFirstQuestionId: number | null,
): FunFactBonusAward => ({
  teamId,
  category: 'shot',
  points,
  blockFirstQuestionId,
});

function session(overrides: Partial<SessionState> = {}): SessionState {
  return sessionWith(
    ROUNDS,
    { status: 'reveal', roundIndex: 2, questionIndex: 0 },
    {
      openedQuestionIds: [1, 2, 3, 4],
      leaderboard: [
        team(1, 'A', [3, 2, 5]),
        team(2, 'B', [1, 1, 10]),
        team(3, 'C', [0, 4, 0]),
      ],
      ...overrides,
    },
  );
}

const teamsOf = (board: { groups: { teams: unknown[] }[] }) =>
  board.groups.flatMap((g) => g.teams) as {
    teamName: string;
    totalPoints: number;
    callouts: string[];
    hasLeft?: boolean;
  }[];
const byName = (board: Parameters<typeof teamsOf>[0], name: string) =>
  teamsOf(board).find((t) => t.teamName === name)!;

describe('describeBlockBoards', () => {
  it('has one board per block, placed on the block last round', () => {
    expect(describeBlockBoards(session()).map((b) => b.roundIndex)).toEqual([
      1, 2, 3,
    ]);
  });

  it('puts a quickfire quiz marker after each round', () => {
    const quickfire = [
      round(1, [1, 2], { quickfire: true }),
      round(2, [3, 4], { quickfire: true }),
    ];
    const boards = describeBlockBoards(
      sessionWith(quickfire, {}, { openedQuestionIds: [1, 2, 3] }),
    );

    expect(boards.map((b) => b.roundIndex)).toEqual([0, 1]);
  });

  it('rebuilds each block total from round points up to the block, bottom-up', () => {
    const [first, second] = describeBlockBoards(session());

    expect(teamsOf(first).map((t) => [t.teamName, t.totalPoints])).toEqual([
      ['B', 2],
      ['C', 4],
      ['A', 5],
    ]);
    expect(teamsOf(second).map((t) => [t.teamName, t.totalPoints])).toEqual([
      ['C', 4],
      ['A', 10],
      ['B', 12],
    ]);
  });

  it('gives the first block no movement line but a gain', () => {
    const [first] = describeBlockBoards(session());

    expect(byName(first, 'A').callouts).toEqual(
      expect.arrayContaining(['+5 this block']),
    );
    expect(byName(first, 'A').callouts).not.toContainEqual(
      expect.stringMatching(/up from|down from|holds|moved up/),
    );
  });

  it('measures movement, gain and biggest gain against the block before', () => {
    const [, second] = describeBlockBoards(session());

    expect(byName(second, 'B').callouts).toEqual([
      '+10 this block',
      'up from 3rd',
      'leads by 2',
      'biggest gain this block',
    ]);
    expect(byName(second, 'A').callouts).toEqual([
      '+5 this block',
      'down from 1st',
      '2 points behind 1st',
    ]);
    expect(byName(second, 'C').callouts).toEqual([
      'down from 2nd',
      '6 points behind 2nd',
    ]);
  });

  it('says every team moved up when all were tied before the block', () => {
    const tiedAfterFirst = session({
      leaderboard: [
        team(1, 'A', [1, 1, 5]),
        team(2, 'B', [1, 1, 4]),
        team(3, 'C', [1, 1, 3]),
      ],
    });
    const [, second] = describeBlockBoards(tiedAfterFirst);

    expect(byName(second, 'A').callouts).toContain('moved up');
  });

  it('counts bonuses by block and unstamped awards in the latest board only', () => {
    const [first, second] = describeBlockBoards(
      session({
        funFactData: {
          answers: [],
          powerUps: [],
          bonusAwards: [award(1, 3, 1), award(1, -2, 4), award(3, 1, null)],
        },
      }),
    );

    expect(byName(first, 'A').totalPoints).toBe(8);
    expect(byName(first, 'A').callouts).toContain('+3 bonus');
    expect(byName(first, 'C').totalPoints).toBe(4);
    expect(byName(second, 'A').totalPoints).toBe(11);
    expect(byName(second, 'A').callouts).toContain('−2 penalty');
    expect(byName(second, 'A').callouts).not.toContain('+3 bonus');
    expect(byName(second, 'C').totalPoints).toBe(5);
    expect(byName(second, 'C').callouts).toContain('+1 bonus');
  });

  it('shows the final board with whole-quiz lines on the last block only', () => {
    const [, second, third] = describeBlockBoards(
      session({ openedQuestionIds: [1, 2, 3, 4, 5] }),
    );

    expect(second.isFinal).toBe(false);
    expect(third.isFinal).toBe(true);
    expect(byName(third, 'B').callouts).toEqual(['holds 1st', 'leads by 2']);
  });

  it('names the perfect rounds of the block and the joker', () => {
    const answers = [1, 2].map((questionId) => ({
      questionId,
      teamId: 1,
      teamName: 'A',
      verdict: 'correct' as const,
      pointsAwarded: 1,
      responseMs: null,
    }));
    const [first] = describeBlockBoards(
      session({
        funFactData: { answers, bonusAwards: [], powerUps: [] },
        jokers: {
          1: { roundId: 2, source: 'drawn' },
        } as SessionState['jokers'],
      }),
    );

    expect(byName(first, 'A').callouts).toEqual(
      expect.arrayContaining([
        'Perfect round: Music \u{1F525}',
        'Joker 2× on Sport',
      ]),
    );
  });

  it('leaves later blocks without teams and flags the block in play', () => {
    const boards = describeBlockBoards(
      session({ openedQuestionIds: [1, 2, 3], ungradedQuestionIds: [3] }),
    );

    expect(boards[0]).toMatchObject({
      isReached: true,
      isGradingUnfinished: true,
    });
    expect(boards[1]).toMatchObject({ isReached: false, groups: [] });
  });

  it('flags grading unfinished only for the block in play', () => {
    const boards = describeBlockBoards(session({ ungradedQuestionIds: [4] }));

    expect(boards.map((b) => b.isGradingUnfinished)).toEqual([
      false,
      true,
      false,
    ]);
    expect(
      describeBlockBoards(session()).map((b) => b.isGradingUnfinished),
    ).toEqual([false, false, false]);
  });

  it('keeps teams that left on the boards they took part in, tagged left', () => {
    const { rank: _rank, rankTo: _rankTo, ...gone } = team(4, 'D', [0, 0, 9]);
    const [first, second] = describeBlockBoards(
      session({ departedTeams: [gone] }),
    );

    expect(teamsOf(first).map((t) => t.teamName)).not.toContain('D');
    expect(byName(second, 'D').hasLeft).toBe(true);
    expect(byName(second, 'A').hasLeft).toBeUndefined();
  });

  it('marks the board on the big screen as on air', () => {
    const live = session({
      progress: {
        ...session().progress,
        isLeaderboardVisible: true,
      },
      priorStandings: {
        board: [
          team(1, 'A', [3, 2]),
          team(2, 'B', [1, 1]),
          team(3, 'C', [0, 4]),
        ],
        blockFirstQuestionId: 4,
      },
    });

    expect(describeBlockBoards(live).map((b) => b.isOnAir)).toEqual([
      false,
      true,
      false,
    ]);
    expect(describeBlockBoards(session()).map((b) => b.isOnAir)).toEqual([
      false,
      false,
      false,
    ]);
  });

  it('goes to the admin room only', () => {
    expect(projectScreen(session(), SOCKET_ROOMS.ADMIN).blockBoards).toEqual(
      describeBlockBoards(session()),
    );
    expect(projectScreen(session(), SOCKET_ROOMS.DISPLAY)).not.toHaveProperty(
      'blockBoards',
    );
    expect(projectScreen(session(), SOCKET_ROOMS.PLAYERS)).not.toHaveProperty(
      'blockBoards',
    );
  });
});
