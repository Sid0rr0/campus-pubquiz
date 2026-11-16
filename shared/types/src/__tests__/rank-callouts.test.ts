import { describe, expect, it } from 'vitest';
import type { FunFactAnswer } from '../fun-facts';
import { describeLiveRankBoard } from '../rank-callouts';
import { projectScreen } from '../screen-projection';
import { SOCKET_ROOMS } from '../socket-events';
import type { LeaderboardEntry } from '../room-views';
import type { SessionState } from '../session-state';
import { leaderboardEntry, round, sessionWith } from './session-fixtures';

// Block 1 is rounds 1 and 2 (round 1 has no break); block 2 is round 3.
const ROUNDS = [
  round(1, [1, 2], { breakAfter: false, title: 'Music' }),
  round(2, [3], { title: 'Sport' }),
  round(3, [4], { title: 'Film' }),
];

function entry(
  teamId: number,
  name: string,
  points: number,
  extra: Partial<LeaderboardEntry> = {},
): LeaderboardEntry {
  return { ...leaderboardEntry(teamId, name, points), ...extra };
}

function answer(questionId: number, teamId: number): FunFactAnswer {
  return {
    questionId,
    teamId,
    teamName: `T${teamId}`,
    verdict: 'correct',
    pointsAwarded: 1,
    responseMs: null,
  };
}

/** Block 2 scored: the leaderboard is up at its reveal, over the given prior board. */
function live(
  leaderboard: LeaderboardEntry[],
  prior: LeaderboardEntry[],
  revealCount: number,
  overrides: Partial<SessionState> = {},
): SessionState {
  return sessionWith(
    ROUNDS,
    {
      status: 'reveal',
      roundIndex: 2,
      questionIndex: 0,
      isLeaderboardVisible: true,
    },
    {
      leaderboard,
      leaderboardRevealCount: revealCount,
      priorStandings: { board: prior, blockFirstQuestionId: 4 },
      ...overrides,
    },
  );
}

const PRIOR = [entry(1, 'A', 10), entry(2, 'B', 8), entry(3, 'C', 5)];
// A 10 -> 12 (+2, drops to 2nd), B 8 -> 15 (+7, up), C 5 -> 5 (last, no gain).
const NOW = [entry(1, 'A', 12), entry(2, 'B', 15), entry(3, 'C', 5)];

const names = (group: { teams: { teamName: string }[] } | null | undefined) =>
  group?.teams.map((team) => team.teamName);

describe('the live board in the room views', () => {
  it('goes to the admin room only', () => {
    const session = live(NOW, PRIOR, 1);

    expect(projectScreen(session, SOCKET_ROOMS.ADMIN).liveRankBoard).toEqual(
      describeLiveRankBoard(session),
    );
    expect(projectScreen(session, SOCKET_ROOMS.DISPLAY)).not.toHaveProperty(
      'liveRankBoard',
    );
    expect(projectScreen(session, SOCKET_ROOMS.PLAYERS)).not.toHaveProperty(
      'liveRankBoard',
    );
  });
});

describe('the final board', () => {
  const final = (overrides: Partial<SessionState> = {}) =>
    live(NOW, PRIOR, 0, {
      progress: {
        ...live(NOW, PRIOR, 0).progress,
        status: 'ended',
      },
      ...overrides,
    });
  const linesOf = (session: SessionState, revealCount: number) =>
    describeLiveRankBoard({ ...session, leaderboardRevealCount: revealCount })
      ?.current?.teams[0].callouts;

  it('counts perfect rounds over the whole quiz', () => {
    const session = final({
      funFactData: {
        answers: [1, 2, 3, 4].map((q) => answer(q, 2)),
        bonusAwards: [],
        powerUps: [],
      },
    });

    expect(linesOf(session, 3)).toContain('3 perfect rounds tonight');
  });

  it('keeps movement and the lead but drops block-only lines', () => {
    const session = final({
      jokers: { 2: { roundId: 3, source: 'drawn' } } as SessionState['jokers'],
    });

    expect(linesOf(session, 3)).toEqual(['up from 2nd', 'leads by 3']);
  });
});

describe('the board between quickfire questions', () => {
  it('shows the top 5 with their gains all at once', () => {
    const quickfire = [round(1, [1, 2, 3, 4, 5, 6, 7], { quickfire: true })];
    const prior = [1, 2, 3, 4, 5, 6].map((id) => entry(id, `T${id}`, 0));
    const now = [1, 2, 3, 4, 5, 6].map((id) => entry(id, `T${id}`, 10 - id));
    const session = sessionWith(
      quickfire,
      {
        status: 'question_open',
        roundIndex: 0,
        questionIndex: 1,
        isLeaderboardVisible: true,
      },
      {
        leaderboard: now,
        priorStandings: { board: prior, blockFirstQuestionId: 1 },
      },
    );

    const board = describeLiveRankBoard(session);

    expect(board?.current).toBeNull();
    expect(board?.next).toBeNull();
    expect(board?.all?.map((g) => g.teams[0].teamName)).toEqual([
      'T1',
      'T2',
      'T3',
      'T4',
      'T5',
    ]);
    expect(board?.all?.[0].teams[0].callouts).toEqual(['+9']);
  });
});

describe('a quickfire round-end board', () => {
  it('keeps the one-by-one reveal, capped to the top 5', () => {
    const quickfire = [round(1, [1, 2], { quickfire: true })];
    const now = [1, 2, 3, 4, 5, 6].map((id) => entry(id, `T${id}`, 10 - id));
    const session = sessionWith(
      quickfire,
      {
        status: 'round_intro',
        roundIndex: 0,
        questionIndex: 0,
        furthestOpenIndex: -1,
        isLeaderboardVisible: true,
      },
      {
        leaderboard: now,
        leaderboardRevealCount: 1,
        priorStandings: { board: [], blockFirstQuestionId: 1 },
      },
    );

    const board = describeLiveRankBoard(session);

    expect(board?.all).toBeUndefined();
    expect(names(board?.current)).toEqual(['T5']);
    expect(names(board?.next)).toEqual(['T4']);
  });
});

describe('describeLiveRankBoard', () => {
  describe('groups', () => {
    it('shows only the next group before the first Advance', () => {
      const board = describeLiveRankBoard(live(NOW, PRIOR, 0));

      expect(board?.current).toBeNull();
      expect(names(board?.next)).toEqual(['C']);
    });

    it('shows the group just revealed and the one after it mid-reveal', () => {
      const board = describeLiveRankBoard(live(NOW, PRIOR, 1));

      expect(names(board?.current)).toEqual(['C']);
      expect(names(board?.next)).toEqual(['A']);
    });

    it('shows only the current group once the winner is revealed', () => {
      const board = describeLiveRankBoard(live(NOW, PRIOR, 3));

      expect(names(board?.current)).toEqual(['B']);
      expect(board?.next).toBeNull();
    });

    it('reveals tied teams together as one group', () => {
      const tied = [entry(1, 'A', 9), entry(2, 'B', 9), entry(3, 'C', 5)];
      const board = describeLiveRankBoard(live(tied, PRIOR, 2));

      expect(names(board?.current)).toEqual(['A', 'B']);
      expect(board?.next).toBeNull();
    });

    it('is absent when the leaderboard is not showing a block result', () => {
      const session = live(NOW, PRIOR, 0, { priorStandings: null });

      expect(describeLiveRankBoard(session)).toBeNull();
    });
  });

  describe('callouts', () => {
    const lines = (session: SessionState, revealCount: number) =>
      describeLiveRankBoard({ ...session, leaderboardRevealCount: revealCount })
        ?.current?.teams[0].callouts;

    it('names points gained, movement, the gap above and the biggest gain', () => {
      const session = live(NOW, PRIOR, 0);

      expect(lines(session, 3)).toEqual([
        '+7 this block',
        'up from 2nd',
        'leads by 3',
        'biggest gain this block',
      ]);
      expect(lines(session, 2)).toEqual([
        '+2 this block',
        'down from 1st',
        '3 points behind 1st',
      ]);
    });

    it('says a team that gained nothing holds its place, with no gain line', () => {
      expect(lines(live(NOW, PRIOR, 0), 1)).toEqual([
        'holds 3rd',
        '7 points behind 2nd',
      ]);
    });

    it('marks every team tied on the biggest gain', () => {
      const now = [entry(1, 'A', 14), entry(2, 'B', 12), entry(3, 'C', 5)];
      const session = live(now, PRIOR, 0);

      expect(lines(session, 3)).toContain('biggest gain this block');
      expect(lines(session, 2)).toContain('biggest gain this block');
    });

    it('has no biggest gain when nobody gained', () => {
      const session = live(PRIOR, PRIOR, 0);

      expect(lines(session, 3)).not.toContain('biggest gain this block');
    });

    it('names the perfect round of the block, not of an earlier one', () => {
      const session = live(NOW, PRIOR, 0, {
        funFactData: {
          answers: [answer(1, 2), answer(2, 2), answer(4, 2), answer(4, 1)],
          bonusAwards: [],
          powerUps: [],
        },
      });

      expect(lines(session, 3)).toContain('Perfect round: Film \u{1F525}');
      expect(lines(session, 2)).toContain('Perfect round: Film \u{1F525}');
      expect(lines(session, 1)).not.toContainEqual(
        expect.stringContaining('Perfect'),
      );
    });

    it('names a joker on a round of the block', () => {
      const session = live(NOW, PRIOR, 0, {
        jokers: {
          2: { roundId: 3, source: 'drawn' },
        } as SessionState['jokers'],
      });

      expect(lines(session, 3)).toContain('Joker 2× on Film');
      expect(lines(session, 2)).not.toContainEqual(
        expect.stringContaining('Joker'),
      );
    });

    it('reports bonus and penalty points earned since the block began', () => {
      const now = [
        entry(1, 'A', 12, { positiveBonusPoints: 3, negativeBonusPoints: -2 }),
        entry(2, 'B', 15),
        entry(3, 'C', 5),
      ];

      expect(lines(live(now, PRIOR, 0), 2)).toEqual(
        expect.arrayContaining(['+3 bonus', '−2 penalty']),
      );
    });

    it('says tied teams share the lead and names who they tie with', () => {
      const tied = [entry(1, 'A', 15), entry(2, 'B', 15), entry(3, 'C', 5)];
      const session = live(tied, PRIOR, 0);

      const group = describeLiveRankBoard({
        ...session,
        leaderboardRevealCount: 2,
      })?.current;

      expect(group?.teams.map((team) => team.callouts)).toEqual([
        expect.arrayContaining(['shares the lead', 'tied with B']),
        expect.arrayContaining(['shares the lead', 'tied with A']),
      ]);
    });

    it('says every team moved up when all were tied beforehand, as the big screen trends do', () => {
      const prior = [entry(1, 'A', 0), entry(2, 'B', 0), entry(3, 'C', 0)];

      expect(lines(live(NOW, prior, 0), 3)).toContain('moved up');
      expect(lines(live(NOW, prior, 0), 3)).not.toContainEqual(
        expect.stringMatching(/up from|down from|holds/),
      );
    });

    it('gives a lone team no gap line', () => {
      const session = live([entry(1, 'A', 12)], [entry(1, 'A', 10)], 1);

      expect(
        describeLiveRankBoard(session)?.current?.teams[0].callouts,
      ).toEqual(['+2 this block', 'holds 1st', 'biggest gain this block']);
    });
  });
});
